const fetch = require('node-fetch');
(async () => {
  const res = await fetch('https://3.139.128.30.sslip.io/api/trpc/auth.login?batch=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "0": { "json": { "firstName": "Test", "lastName": "User", "email": "test2@lee-associates.com" } }
    })
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
  process.exit(0);
})();
