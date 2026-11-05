from datetime import date
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

def number(value, label, maximum=None):
    try:
        result = Decimal(str(value))
        if not result.is_finite() or result < 0 or (maximum is not None and result > maximum):
            raise ValueError()
        return result
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f'Enter a valid {label}.')


def money(value):
    return float(value.quantize(Decimal('.01'), rounding=ROUND_HALF_UP))


def tax_mode(state):
    normalized = ''.join(character for character in str(state or '').lower() if character.isalpha())
    if not normalized:
        return 'unspecified'
    return 'intra' if normalized in ['tn', 'tamilnadu'] else 'inter'


def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError('Invalid quotation.')
    try:
        date.fromisoformat(payload.get('date', ''))
    except (ValueError, TypeError):
        raise ValueError('Enter a valid quotation date.')
    for key, label in [('billTo', 'billing'), ('shipTo', 'shipping')]:
        if not isinstance(payload.get(key), dict) or not str(payload[key].get('name', '')).strip():
            raise ValueError(f'Enter a {label} name.')
        state = payload[key].get('state', '')
        if not isinstance(state, str) or not state.strip():
            raise ValueError(f'Select a {label} state.')
        phone = payload[key].get('phone', '')
        if not isinstance(phone, str) or not re.fullmatch(r'[0-9]{10}', phone):
            raise ValueError(f'Enter a 10-digit {label} contact number using digits only.')
    items = payload.get('items')
    if not isinstance(items, list) or not items:
        raise ValueError('Add at least one item.')
    subtotal = Decimal(0)
    discount_total = Decimal(0)
    tax_total = Decimal(0)
    mode = tax_mode(payload['billTo'].get('state'))
    tax_buckets = {}
    for item in items:
        if not isinstance(item, dict) or not str(item.get('name', '')).strip():
            raise ValueError('Enter a name for every item.')
        quantity = number(item.get('quantity'), 'quantity')
        if quantity == 0:
            raise ValueError('Quantity must be greater than zero.')
        price = number(item.get('price'), 'unit price')
        discount = number(item.get('discount'), 'discount percentage', 100)
        tax = number(item.get('tax'), 'tax rate')
        if tax not in [Decimal('0'), Decimal('.1'), Decimal('5'), Decimal('12'), Decimal('18')]:
            raise ValueError('Select a supported tax rate.')
        if mode == 'inter':
            tax = Decimal(18)
        if item.get('unit') not in ["No's", 'kg', 'm']:
            raise ValueError('Select a valid unit.')
        if item.get('warranty') not in ['yes', 'no']:
            raise ValueError('Select a warranty option.')
        if item.get('warranty') == 'yes':
            if number(item.get('years'), 'warranty duration') <= 0 or item.get('coverage') not in ['service', 'replacement']:
                raise ValueError('Enter warranty years and coverage.')
        gross = quantity * price
        reduction = gross * discount / 100
        net = gross - reduction
        component = Decimal(str(money(net * tax / (200 if mode == 'intra' else 100))))
        line_tax = component * 2 if mode == 'intra' else component
        tax_buckets[tax] = tax_buckets.get(tax, Decimal(0)) + component
        subtotal += gross
        discount_total += reduction
        tax_total += line_tax
        item['total'] = money(net + line_tax)
        item['appliedTax'] = float(tax)
    freight = number(payload.get('freightCharges', 0), 'freight charges')
    if payload.get('freight') not in ['paid', 'to_pay']:
        raise ValueError('Select a freight payment option.')
    breakdown = []
    for rate, amount in sorted(tax_buckets.items()):
        if mode == 'intra':
            for kind in ['CGST', 'SGST']:
                breakdown.append({'label': f'{kind} @ {float(rate / 2):g}%', 'amount': money(amount)})
        else:
            kind = 'IGST' if mode == 'inter' else 'GST'
            breakdown.append({'label': f'{kind} @ {float(rate):g}%', 'amount': money(amount)})
    unrounded_total = Decimal(str(money(subtotal - discount_total + tax_total + freight)))
    rounded_total = unrounded_total.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    payload['totals'] = {
        'subtotal': money(subtotal), 'discount': money(discount_total),
        'taxable': money(subtotal - discount_total), 'tax': money(tax_total),
        'taxMode': mode, 'taxBreakdown': breakdown,
        'cgst': money(tax_total / 2) if mode == 'intra' else 0,
        'sgst': money(tax_total / 2) if mode == 'intra' else 0,
        'igst': money(tax_total) if mode == 'inter' else 0,
        'freight': money(freight), 'unroundedTotal': money(unrounded_total),
        'roundOff': money(rounded_total - unrounded_total), 'total': money(rounded_total)
    }
    return payload


