const app = require('./src/app');

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Mercearia Costa rodando em http://localhost:${PORT}`);
});
