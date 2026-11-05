import copy
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
import unittest
from sqlalchemy import text

from app import app
from config import load_settings
from database import get_engine
from manage_db import init_database, server_engine


@unittest.skipUnless(os.environ.get('RUN_MYSQL_TESTS') == '1', 'Set RUN_MYSQL_TESTS=1 to run database tests')
class QuotationTests(unittest.TestCase):
    def setUp(self):
        self.previous_config = dict(app.config)
        self.settings = load_settings()
        self.settings.update(
            DB_NAME='weider_erp_test_' + uuid.uuid4().hex[:12],
            DB_USER=os.environ.get('MYSQL_TEST_USER', 'root'),
            DB_PASSWORD=os.environ.get('MYSQL_TEST_PASSWORD', ''),
        )
        init_database(self.settings)
        app.config.update(self.settings, TESTING=True)
        self.client = app.test_client()
        self.quote = {
            'date': '2026-11-04', 'billTo': {'name': 'Test customer', 'state': 'Tamil Nadu', 'phone': '9876543210'},
            'shipTo': {'name': 'Test warehouse', 'state': 'Tamil Nadu', 'phone': '9876543210'},
            'items': [{'name': 'Industrial scale', 'hsn': '8423', 'quantity': 2,
                       'unit': "No's", 'price': 1000, 'discount': 10, 'tax': 18,
                       'warranty': 'yes', 'years': 2, 'coverage': 'service'}],
            'freight': 'to_pay', 'freightCharges': 100,
            'deliveryTime': '7 days', 'validity': '30 days'
        }

    def tearDown(self):
        get_engine(self.settings).dispose()
        engine = server_engine(self.settings)
        try:
            with engine.begin() as connection:
                # Only remove the randomly named schema created by this test.
                connection.execute(text(f"DROP DATABASE `{self.settings['DB_NAME']}`"))
        finally:
            engine.dispose()
            app.config.clear()
            app.config.update(self.previous_config)

    def test_save_read_and_update(self):
        response = self.client.post('/api/quotations', json=self.quote)
        self.assertEqual(response.status_code, 200)
        saved = response.get_json()
        self.assertEqual(saved['number'], 'QT-00001')
        self.assertEqual(saved['totals']['total'], 2224)
        self.assertEqual(saved['totals']['tax'], 324)
        self.assertEqual(saved['totals']['taxable'], 1800)
        self.assertEqual(saved['items'][0]['total'], 2124)
        self.assertEqual(self.client.get('/api/quotations/1').get_json(), saved)
        saved['items'][0]['quantity'] = 3
        saved['totals']['total'] = 1
        updated = self.client.post('/api/quotations', json=saved).get_json()
        self.assertEqual(updated['number'], saved['number'])
        self.assertEqual(updated['totals']['total'], 3286)
        self.assertEqual(len(self.client.get('/api/quotations').get_json()), 1)

    def test_next_number_shows_serial_without_creating_a_quotation(self):
        for _ in range(2):
            self.assertEqual(self.client.get('/api/quotations/next-number').get_json(), {'number': 'QT-00001'})
        self.assertEqual(self.client.get('/api/quotations').get_json(), [])
        saved = self.client.post('/api/quotations', json=self.quote).get_json()
        self.assertEqual(saved['number'], 'QT-00001')
        self.assertEqual(self.client.get('/api/quotations/next-number').get_json(), {'number': 'QT-00002'})
        saved['number'] = 'QT-99999'
        self.assertEqual(self.client.post('/api/quotations', json=saved).get_json()['number'], 'QT-00001')
        self.assertEqual(self.client.get('/api/quotations/next-number').get_json(), {'number': 'QT-00002'})

    def test_validity_date_is_preserved_when_saved_and_reopened(self):
        payload = copy.deepcopy(self.quote)
        payload['validity'] = '2026-11-19'
        saved = self.client.post('/api/quotations', json=payload).get_json()
        self.assertEqual(saved['validity'], '2026-11-19')
        self.assertEqual(self.client.get('/api/quotations').get_json()[0]['validity'], '2026-11-19')
        self.assertEqual(self.client.get(f"/api/quotations/{saved['id']}").get_json()['validity'], '2026-11-19')
        saved['validity'] = '2026-12-01'
        updated = self.client.post('/api/quotations', json=saved).get_json()
        self.assertEqual(updated['validity'], '2026-12-01')
        self.assertEqual(self.client.get('/api/quotations').get_json()[0]['validity'], '2026-12-01')

    def test_rates_and_rounding(self):
        for rate, expected in [(0, 100), (.1, 100), (5, 105), (12, 112), (18, 118)]:
            payload = copy.deepcopy(self.quote)
            payload['items'][0].update(quantity=1, price=100, discount=0, tax=rate)
            payload['freightCharges'] = 0
            self.assertEqual(self.client.post('/api/quotations', json=payload).get_json()['totals']['total'], expected)

    def test_invalid_values(self):
        for key, value in [('quantity', 0), ('price', -1), ('discount', 101), ('tax', 25), ('price', 'NaN'), ('years', 0)]:
            payload = copy.deepcopy(self.quote)
            payload['items'][0][key] = value
            self.assertEqual(self.client.post('/api/quotations', json=payload).status_code, 400)
        self.assertEqual(self.client.post('/api/quotations', json={}).status_code, 400)
        self.assertEqual(self.client.get('/api/quotations/999').status_code, 404)

    def test_contact_numbers_require_ten_ascii_digits(self):
        for address in ['billTo', 'shipTo']:
            for phone in ['123456789', '12345678901', '98765abcde', '+919876543210', '98765 4321', '９８７６５４３２１０']:
                payload = copy.deepcopy(self.quote)
                payload[address]['phone'] = phone
                response = self.client.post('/api/quotations', json=payload)
                self.assertEqual(response.status_code, 400)
            for phone in ['9876543210', '0123456789']:
                payload = copy.deepcopy(self.quote)
                payload[address]['phone'] = phone
                response = self.client.post('/api/quotations', json=payload)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json()[address]['phone'], phone)

    def test_billing_and_shipping_require_state_and_contact_number(self):
        for address in ['billTo', 'shipTo']:
            for field in ['state', 'phone']:
                for value in ['', '   ', None]:
                    payload = copy.deepcopy(self.quote)
                    payload[address][field] = value
                    self.assertEqual(self.client.post('/api/quotations', json=payload).status_code, 400)
                payload = copy.deepcopy(self.quote)
                del payload[address][field]
                self.assertEqual(self.client.post('/api/quotations', json=payload).status_code, 400)
        payload = copy.deepcopy(self.quote)
        payload['shipTo'] = copy.deepcopy(payload['billTo'])
        self.assertEqual(self.client.post('/api/quotations', json=payload).status_code, 200)

    def test_tamil_nadu_tax_split_and_interstate_override(self):
        for state in ['Tamil Nadu', 'TN', ' tamil nadu ']:
            payload = copy.deepcopy(self.quote)
            payload['billTo']['state'] = state
            payload['items'][0]['tax'] = 12
            saved = self.client.post('/api/quotations', json=payload).get_json()
            self.assertEqual(saved['totals']['cgst'], 108)
            self.assertEqual(saved['totals']['sgst'], 108)
            self.assertEqual(saved['totals']['igst'], 0)
            self.assertEqual(saved['totals']['taxBreakdown'], [
                {'label': 'CGST @ 6%', 'amount': 108}, {'label': 'SGST @ 6%', 'amount': 108}])
        payload['billTo']['state'] = 'Karnataka'
        saved = self.client.post('/api/quotations', json=payload).get_json()
        self.assertEqual(saved['items'][0]['tax'], 12)
        self.assertEqual(saved['items'][0]['appliedTax'], 18)
        self.assertEqual(saved['items'][0]['total'], 2124)
        self.assertEqual(saved['totals']['cgst'], 0)
        self.assertEqual(saved['totals']['sgst'], 0)
        self.assertEqual(saved['totals']['igst'], 324)
        self.assertEqual(saved['totals']['taxBreakdown'], [{'label': 'IGST @ 18%', 'amount': 324}])

    def test_component_rounding_matches_line_totals(self):
        payload = copy.deepcopy(self.quote)
        payload['billTo']['state'] = 'Tamil Nadu'
        payload['items'][0].update(quantity=1, price=10, discount=0, tax=.1)
        payload['freightCharges'] = 0
        saved = self.client.post('/api/quotations', json=payload).get_json()
        self.assertEqual(saved['totals']['cgst'], .01)
        self.assertEqual(saved['totals']['sgst'], .01)
        self.assertEqual(saved['totals']['unroundedTotal'], 10.02)
        self.assertEqual(saved['totals']['roundOff'], -.02)
        self.assertEqual(saved['totals']['total'], 10)
        self.assertEqual(saved['items'][0]['total'], 10.02)

    def test_round_off_is_saved_with_positive_negative_and_half_rupee_values(self):
        for price, total, adjustment in [(.95, 1, .05), (1.24, 1, -.24), (1.5, 2, .5), (2, 2, 0), (0, 0, 0)]:
            payload = copy.deepcopy(self.quote)
            payload['items'][0].update(quantity=1, price=price, discount=0, tax=0)
            payload['freightCharges'] = 0
            saved = self.client.post('/api/quotations', json=payload).get_json()
            self.assertEqual(saved['totals']['unroundedTotal'], price)
            self.assertEqual(saved['totals']['roundOff'], adjustment)
            self.assertEqual(saved['totals']['total'], total)
            reopened = self.client.get(f"/api/quotations/{saved['id']}").get_json()
            self.assertEqual(reopened['totals'], saved['totals'])
            row = next(row for row in self.client.get('/api/quotations').get_json() if row['id'] == saved['id'])
            self.assertEqual(row['total'], total)


    def test_concurrent_saves_receive_unique_quotation_numbers(self):
        def save_one(index):
            payload = copy.deepcopy(self.quote)
            payload['billTo']['name'] = f'Concurrent customer {index}'
            with app.test_client() as client:
                response = client.post('/api/quotations', json=payload)
                return response.status_code, response.get_json()
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(save_one, range(8)))
        self.assertTrue(all(status == 200 for status, _ in results))
        self.assertEqual(len({payload['number'] for _, payload in results}), 8)
        self.assertEqual(len({payload['id'] for _, payload in results}), 8)
        self.assertEqual(len(self.client.get('/api/quotations').get_json()), 8)


if __name__ == '__main__':
    unittest.main()
