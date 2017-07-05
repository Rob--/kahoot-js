const EventEmitter = require('events');
const vm = require('vm');
const request = require('request');
const cometd = require('cometd');
const Timesync = require('cometd/TimeSyncExtension');
require('cometd-nodejs-client').adapt();

const has = Object.prototype.hasOwnProperty;

const MessageID = {
  GAME_BLOCK_ANSWER: 45,
};

class Kahoot extends EventEmitter {
  constructor(username) {
    super();
    this.username = username;
  }

  join(id) {
    this.id = id;

    const options = {
      url: `https://kahoot.it/reserve/session/${this.id}/?${new Date().getTime()}`,
      json: true,
    };

    request(options, (error, response, body) => {
      if (error) {
        console.log(error);
      }

      if (!has.call(response.headers, 'x-kahoot-session-token')) {
        console.log('No session token found, unable to join');
        return;
      }

      const decoded = vm.runInNewContext(body.challenge, {
        angular: {
          isString: () => true,
          isArray: () => true,
          isObject: () => true,
          isDate: () => true,
        },
        _: {
          replace: (...args) => {
            const string = `${args[0]}`;
            return args.length < 3 ? string : string.replace(args[1], args[2]);
          },
        },
      });

      const decodedBase64 = Buffer.from(response.headers['x-kahoot-session-token'], 'base64').toString('binary');
      this.setupComet(Kahoot.getToken(decodedBase64, decoded));
    });
  }

  setupComet(cometToken) {
    this.comet = new cometd.CometD();

    this.comet.configure({
      url: `https://kahoot.it/cometd/${this.id}/${cometToken}`,
      maxNetworkDelay: 40000,
      // logLevel: 'debug',
    });

    this.comet.registerExtension('timesync', new Timesync());

    // handshake for connection initialisation
    this.comet.addListener('/meta/handshake', (response) => {
      if (!response.successful) {
        return;
      }

      this.comet.publish('/service/controller', {
        type: 'login',
        gameid: this.id,
        host: 'kahoot.it',
        name: this.username,
      });
    });

    // heartbeat
    this.comet.addListener('/meta/connect', () => {
      // cometd.publish('/meta/connect');
    });

    this.comet.addListener('/service/controller', (response) => {
      if (response.data.type === 'loginResponse') {
        this.emit('connected');
      }
    });

    // various servies for player (answering questions etc)
    this.comet.addListener('/service/player', (response) => {
      const content = JSON.parse(response.data.content);

      if (has.call(content, 'questionIndex') && !has.call(content, 'timeLeft')) {
        this.emit('question', {
          question: content.questionIndex,
          answers: content.quizQuestionAnswers[content.questionIndex],
        });
      }
    });

    // cometd.addListener('/meta/subscribe', console.log);
    // cometd.addListener('/meta/unsuccessful', console.log);

    // start heartbeat
    this.comet.handshake();
  }

  submitAnswer(question, answer) {
    this.comet.publish('/service/controller', {
      type: 'message',
      gameid: this.id,
      host: 'kahoot.it',
      id: MessageID.GAME_BLOCK_ANSWER,
      content: JSON.stringify({
        type: 'quiz',
        choice: answer,
        questionIndex: question,
      }),
    });
  }

  static getToken(encodedToken, decodedToken) {
    let n = '';

    for (let i = 0; i < encodedToken.length; i += 1) {
      const e = encodedToken.charCodeAt(i);
      const d = decodedToken.charCodeAt(i % decodedToken.length);

      // eslint-disable-next-line
      n += String.fromCharCode(e ^ d);
    }

    return n;
  }
}

module.exports = Kahoot;
