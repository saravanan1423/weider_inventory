import tempfile
import unittest
from pathlib import Path

from config import load_settings
from database import database_url


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def test_defaults_use_mysql_and_preserve_the_lan_port(self):
        settings = load_settings(self.root, environ={})
        self.assertEqual(settings['HOST'], '0.0.0.0')
        self.assertEqual(settings['PORT'], 5050)
        self.assertFalse(settings['DEBUG'])
        self.assertEqual(settings['DB_HOST'], '127.0.0.1')
        self.assertEqual(settings['DB_NAME'], 'weider_erp')
        self.assertEqual(settings['DB_PORT'], 3306)
        self.assertEqual(database_url(settings).drivername, 'mysql+pymysql')
        self.assertTrue({'DATABASE', 'DATABASE_TIMEOUT', 'DB_BACKEND'}.isdisjoint(settings))

    def test_dotenv_values_and_environment_overrides(self):
        (self.root / '.env').write_text('DB_NAME=weider_test\nDB_HOST=localhost\nDB_PORT=3307\nDB_CONNECT_TIMEOUT=7\nFLASK_HOST=127.0.0.1\nFLASK_PORT=5051\nFLASK_DEBUG=true\n')
        settings = load_settings(self.root, environ={'FLASK_PORT': '5052'})
        self.assertEqual(settings['DB_NAME'], 'weider_test')
        self.assertEqual(settings['DB_HOST'], 'localhost')
        self.assertEqual(settings['DB_PORT'], 3307)
        self.assertEqual(settings['DB_CONNECT_TIMEOUT'], 7)
        self.assertEqual(settings['HOST'], '127.0.0.1')
        self.assertEqual(settings['PORT'], 5052)
        self.assertTrue(settings['DEBUG'])

    def test_invalid_values_fail_with_the_setting_name(self):
        for name, value in [('FLASK_PORT', '0'), ('FLASK_PORT', '65536'), ('FLASK_PORT', 'abc'), ('FLASK_DEBUG', 'maybe'), ('DB_NAME', 'bad`name'), ('DB_PORT', 'bad'), ('DB_CONNECT_TIMEOUT', '0')]:
            with self.subTest(name=name, value=value):
                with self.assertRaisesRegex(ValueError, name):
                    load_settings(self.root, environ={name: value})

    def test_mysql_password_characters_are_preserved_and_redacted_in_urls(self):
        password = '  p@ss:word/#  '
        settings = load_settings(self.root, environ={'DB_PASSWORD': password})
        self.assertEqual(settings['DB_PASSWORD'], password)
        url = database_url(settings)
        self.assertEqual(url.password, password)
        self.assertNotIn(password, str(url))


if __name__ == '__main__':
    unittest.main()
