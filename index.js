const app = require('./src/server');
const sequelize = require('./src/config/db');

sequelize.sync();

app.listen(3000, () => console.log('app is running!'));
