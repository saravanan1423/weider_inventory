import copy
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
import unittest
from sqlalchemy import text

from app import app
from config import load_settings
from database import get_engine, users, quotations, quotation_reviews
from werkzeug.security import generate_password_hash
from manage_db import init_database, server_engine


class ApiHostingTests(unittest.TestCase):
    def test_backend_is_api_only(self):
        client = app.test_client()
        response = client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['service'], 'Weider ERP API')
        self.assertIsNone(app.static_folder)
        self.assertEqual(client.get('/index.html').status_code, 404)
        self.assertEqual(client.get('/weider-logo.png').status_code, 404)


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
        with get_engine(self.settings).begin() as connection:
            connection.execute(users.insert().values(username='testadmin', name='Test Admin', role='admin',
                                                     active=True, password_hash=generate_password_hash('Admin-test-password')))
        self.sign_in(self.client, 'testadmin', 'Admin-test-password')
        self.quote = {
            'date': '2026-11-04', 'billTo': {'name': 'Test customer', 'state': 'Tamil Nadu', 'phone': '9876543210'},
            'shipTo': {'name': 'Test warehouse', 'state': 'Tamil Nadu', 'phone': '9876543210'},
            'items': [{'name': 'Industrial scale', 'hsn': '8423', 'quantity': 2,
                       'unit': "No's", 'price': 1000, 'discount': 10, 'tax': 18,
                       'warranty': 'yes', 'years': 2, 'coverage': 'service'}],
            'freight': 'to_pay', 'freightCharges': 100,
            'deliveryTime': '7 days', 'validity': '30 days'
        }

    def sign_in(self, client, username, password):
        response = client.post('/api/auth/login', json=dict(username=username, password=password))
        self.assertEqual(response.status_code, 200, response.get_json())
        client.environ_base['HTTP_X_CSRF_TOKEN'] = response.get_json()['csrf']
        return response.get_json()

    def create_regular_user(self, username='salesperson'):
        response = self.client.post('/api/users', json=dict(username=username, name='Sales Person',
                                                          role='user', password='User-test-password'))
        self.assertEqual(response.status_code, 201)
        client = app.test_client()
        self.sign_in(client, username, 'User-test-password')
        return client, response.get_json()['id']

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
                client.set_cookie('weider_session', self.client.get_cookie('weider_session', path='/api').value, path='/api')
                client.environ_base['HTTP_X_CSRF_TOKEN'] = self.client.environ_base['HTTP_X_CSRF_TOKEN']
                response = client.post('/api/quotations', json=payload)
                return response.status_code, response.get_json()
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(save_one, range(8)))
        self.assertTrue(all(status == 200 for status, _ in results))
        self.assertEqual(len({payload['number'] for _, payload in results}), 8)
        self.assertEqual(len({payload['id'] for _, payload in results}), 8)
        self.assertEqual(len(self.client.get('/api/quotations').get_json()), 8)

    def test_login_logout_and_api_protection(self):
        anonymous = app.test_client()
        for path in ['/api/quotations', '/api/quotations/next-number', '/api/users', '/api/approval-requests']:
            self.assertEqual(anonymous.get(path).status_code, 401)
        self.assertEqual(anonymous.post('/api/quotations', json=self.quote).status_code, 401)
        self.assertEqual(anonymous.post('/api/auth/login', json=dict(username='testadmin', password='wrong')).status_code, 401)
        self.assertEqual(self.client.get('/api/auth/me').get_json()['user']['role'], 'admin')
        self.assertNotIn('password_hash', self.client.get('/api/auth/me').get_json()['user'])
        self.assertEqual(self.client.post('/api/auth/logout').status_code, 200)
        self.assertEqual(self.client.get('/api/quotations').status_code, 401)

    def test_user_submission_admin_edit_approval_and_resubmission(self):
        user, user_id = self.create_regular_user()
        forged = copy.deepcopy(self.quote)
        forged.update(status='approved', ownerId=999, approvedBy=user_id)
        saved = user.post('/api/quotations', json=forged).get_json()
        self.assertEqual(saved['status'], 'pending')
        self.assertEqual(saved['ownerId'], user_id)
        self.assertEqual(user.get(f"/api/quotations/{saved['id']}/preview").status_code, 403)
        self.assertEqual(user.post(f"/api/quotations/{saved['id']}/approve", json={'revision': 1}).status_code, 403)
        requests = self.client.get('/api/approval-requests').get_json()
        self.assertEqual(requests[0]['requestedBy'], 'Sales Person')
        self.assertEqual(requests[0]['products'][0]['name'], 'Industrial scale')
        self.assertEqual(requests[0]['products'][0]['price'], 1000)
        saved['items'][0]['price'] = 2000
        edited = self.client.post('/api/quotations', json=saved).get_json()
        self.assertEqual(edited['ownerId'], user_id)
        self.assertEqual(edited['revision'], 2)
        self.assertEqual(self.client.post(f"/api/quotations/{saved['id']}/approve", json={'revision': 1}).status_code, 409)
        approved = self.client.post(f"/api/quotations/{saved['id']}/approve", json={'revision': 2}).get_json()
        self.assertEqual(approved['status'], 'approved')
        self.assertEqual(self.client.get('/api/approval-requests').get_json(), [])
        preview = user.get(f"/api/quotations/{saved['id']}/preview")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.get_json()['items'][0]['price'], 2000)
        approved['items'][0]['price'] = 2100
        submitted = user.post('/api/quotations', json=approved).get_json()
        self.assertEqual(submitted['status'], 'pending')
        self.assertIsNone(submitted['approvedBy'])
        self.assertEqual(user.get(f"/api/quotations/{saved['id']}/preview").status_code, 403)

    def test_users_cannot_access_other_users_quotes_or_manage_accounts(self):
        first, _ = self.create_regular_user()
        second, _ = self.create_regular_user('anotheruser')
        saved = first.post('/api/quotations', json=self.quote).get_json()
        self.assertEqual(second.get('/api/quotations').get_json(), [])
        self.assertEqual(second.get(f"/api/quotations/{saved['id']}").status_code, 404)
        self.assertEqual(second.get(f"/api/quotations/{saved['id']}/preview").status_code, 404)
        self.assertEqual(second.post('/api/quotations', json=saved).status_code, 404)
        self.assertEqual(second.get('/api/approval-requests').status_code, 403)
        self.assertEqual(second.get('/api/users').status_code, 403)
        self.assertEqual(second.post('/api/users', json={}).status_code, 403)

    def test_csrf_and_last_admin_protection(self):
        csrf = self.client.environ_base.pop('HTTP_X_CSRF_TOKEN')
        self.assertEqual(self.client.post('/api/quotations', json=self.quote).status_code, 403)
        self.client.environ_base['HTTP_X_CSRF_TOKEN'] = csrf
        admin = self.client.get('/api/auth/me').get_json()['user']
        response = self.client.put(f"/api/users/{admin['id']}", json={**admin, 'role': 'user'})
        self.assertEqual(response.status_code, 400)
        response = self.client.put(f"/api/users/{admin['id']}", json={**admin, 'active': False})
        self.assertEqual(response.status_code, 400)

    def test_account_disable_and_password_change_revoke_sessions(self):
        user, user_id = self.create_regular_user()
        details = dict(username='salesperson', name='Sales Person', role='user', active=False)
        self.assertEqual(self.client.put(f'/api/users/{user_id}', json=details).status_code, 200)
        self.assertEqual(user.get('/api/quotations').status_code, 401)
        self.assertEqual(user.post('/api/auth/login', json=dict(username='salesperson', password='User-test-password')).status_code, 401)
        details.update(active=True, password='New-user-password')
        self.assertEqual(self.client.put(f'/api/users/{user_id}', json=details).status_code, 200)
        self.assertEqual(user.post('/api/auth/login', json=dict(username='salesperson', password='User-test-password')).status_code, 401)
        self.sign_in(user, 'salesperson', 'New-user-password')

    def test_stale_edit_is_rejected_and_old_quotations_are_admin_only(self):
        saved = self.client.post('/api/quotations', json=self.quote).get_json()
        self.assertEqual(self.client.post('/api/quotations', json=saved).status_code, 200)
        self.assertEqual(self.client.post('/api/quotations', json=saved).status_code, 409)
        with get_engine(self.settings).begin() as connection:
            connection.execute(quotation_reviews.delete().where(quotation_reviews.c.quote_id == saved['id']))
        user, _ = self.create_regular_user()
        self.assertEqual(user.get('/api/quotations').get_json(), [])
        legacy = self.client.get(f"/api/quotations/{saved['id']}").get_json()
        self.assertEqual(legacy['status'], 'pending')
        self.assertEqual(legacy['revision'], 0)
        approved = self.client.post(f"/api/quotations/{saved['id']}/approve", json={'revision': 0})
        self.assertEqual(approved.status_code, 200)

    def test_sign_in_throttling_and_secure_cookie(self):
        anonymous = app.test_client()
        for _ in range(10):
            self.assertEqual(anonymous.post('/api/auth/login', json=dict(username='missing', password='wrong')).status_code, 401)
        self.assertEqual(anonymous.post('/api/auth/login', json=dict(username='missing', password='wrong')).status_code, 429)
        app.config['AUTH_COOKIE_SECURE'] = True
        response = anonymous.post('/api/auth/login', json=dict(username='testadmin', password='Admin-test-password'))
        self.assertIn('Secure', response.headers['Set-Cookie'])
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', response.headers['Set-Cookie'])

    def test_role_changes_are_applied_on_new_sessions_and_old_sessions_are_revoked(self):
        user, user_id = self.create_regular_user()
        details = dict(username='salesperson', name='Sales Person', role='admin', active=True)
        self.assertEqual(self.client.put(f'/api/users/{user_id}', json=details).status_code, 200)
        self.assertEqual(user.get('/api/users').status_code, 401)
        session = self.sign_in(user, 'salesperson', 'User-test-password')
        self.assertEqual(session['user']['role'], 'admin')
        self.assertEqual(user.get('/api/users').status_code, 200)
        details['role'] = 'user'
        self.assertEqual(self.client.put(f'/api/users/{user_id}', json=details).status_code, 200)
        self.assertEqual(user.get('/api/users').status_code, 401)
        self.sign_in(user, 'salesperson', 'User-test-password')
        self.assertEqual(user.get('/api/users').status_code, 403)

    def test_expired_sessions_do_not_authenticate(self):
        from datetime import timedelta
        from auth import utcnow
        from database import auth_sessions
        with get_engine(self.settings).begin() as connection:
            connection.execute(auth_sessions.update().values(expires_at=utcnow() - timedelta(seconds=1)))
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)


if __name__ == '__main__':
    unittest.main()
