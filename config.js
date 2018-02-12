const server_url = process.env.NODE_ENV === 'production' ? 'https://mottet.xyz' : 'http://localhost:8001';

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  PRIVATE_KEY_PATH: process.env.PRIVATE_KEY_PATH,
  CERTIFICATE_PATH: process.env.CERTIFICATE_PATH,
  SERVER_URL: server_url
}