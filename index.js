const chalk = require('chalk');
const Kahoot = require('./Kahoot');

function createUser(username, id) {
  const user = new Kahoot(`${username}`, id);

  user.on('connected', () => {
    console.log(`${chalk.green(`[${username}]`)}: Connected`);
  });

  user.on('question', ({ question, answers }) => {
    const answer = Math.floor(Math.random() * answers);

    console.log(`${chalk.green(`[${username}]`)}: Question ${chalk.yellow(question)} -> Answer ${chalk.yellow(answer)}`);

    user.submitAnswer(question, answer);
  });

  user.join(id);
}

function start() {
  const id = process.argv[2];
  const name = process.argv[3];
  const count = process.argv[4];

  console.log(`${chalk.cyan(`Creating ${count} bots with username ${name}`)}`);
  for (let i = 0; i < count; i += 1) {
    setTimeout(() => createUser(`${name}${i}`, id), i * 100);
  }
}

if (process.argv.length !== 5) {
  console.log('Usage: node index [kahoot id] [username] [bot count]');
  console.log('Example: node index 3601797 george 25');
} else {
  start();
}
