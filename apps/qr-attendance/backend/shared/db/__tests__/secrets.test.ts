const mockGetDBConfig = jest.fn();
const mockInitDB = jest.fn();
const mockSend = jest.fn();

jest.mock('../connection', () => ({
  getDBConfig: (...args: unknown[]) => mockGetDBConfig(...args),
  initDB: (...args: unknown[]) => mockInitDB(...args),
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetSecretValueCommand: jest.fn(),
}));

describe('db/secrets', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DB_SECRET_ARN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initDBFromSecrets', () => {
    it('uses getDBConfig and initDB when DB_SECRET_ARN is not set', async () => {
      const config = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'qr_attendance', ssl: false };
      mockGetDBConfig.mockReturnValue(config);
      const { initDBFromSecrets } = require('../secrets');
      await initDBFromSecrets();
      expect(mockGetDBConfig).toHaveBeenCalled();
      expect(mockInitDB).toHaveBeenCalledWith(config);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('fetches from Secrets Manager when DB_SECRET_ARN is set', async () => {
      process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123:secret:db';
      process.env.DB_HOST = 'rds-host';
      process.env.DB_PORT = '3306';
      process.env.DB_NAME = 'appdb';
      mockSend.mockResolvedValue({
        SecretString: JSON.stringify({ username: 'dbuser', password: 'dbpass' }),
      });
      const { initDBFromSecrets } = require('../secrets');
      await initDBFromSecrets();
      expect(mockSend).toHaveBeenCalled();
      expect(mockInitDB).toHaveBeenCalledWith({
        host: 'rds-host',
        port: 3306,
        user: 'dbuser',
        password: 'dbpass',
        database: 'appdb',
        ssl: false,
      });
    });

    it('passes ssl true when DB_SSL is true', async () => {
      process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123:secret:db';
      process.env.DB_HOST = 'rds';
      process.env.DB_SSL = 'true';
      mockSend.mockResolvedValue({
        SecretString: JSON.stringify({ username: 'u', password: 'p' }),
      });
      const { initDBFromSecrets } = require('../secrets');
      await initDBFromSecrets();
      expect(mockInitDB).toHaveBeenCalledWith(
        expect.objectContaining({ ssl: true })
      );
    });

    it('throws when SecretString is empty', async () => {
      process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123:secret:db';
      mockSend.mockResolvedValue({ SecretString: undefined });
      const { initDBFromSecrets } = require('../secrets');
      await expect(initDBFromSecrets()).rejects.toThrow('Secret string is empty');
    });

    it('rethrows when Secrets Manager send fails', async () => {
      process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123:secret:db';
      mockSend.mockRejectedValue(new Error('Network error'));
      const { initDBFromSecrets } = require('../secrets');
      await expect(initDBFromSecrets()).rejects.toThrow('Network error');
    });
  });
});
