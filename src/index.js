const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose')
const keys = require('./keys')
const { ChartJSNodeCanvas } = require('chartjs-node-canvas')
const datalabels = require('chartjs-plugin-datalabels')

console.log('Bot has been started ...')

mongoose.connect(keys.DB_URL)
  .then(() => console.log('MongoDB connected'))
  .catch((e) => console.log(e))

require('./models/user.model')

const User = mongoose.model('user')

// Создаем элемент canvas
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: 700,
  height: 500,
  backgroundColour: 'white',
  chartCallback: (ChartJS) => {
    ChartJS.register(datalabels)
  }
})

// ========================================

const bot = new TelegramBot(keys.TOKEN, {
  polling: true
})

bot.onText(/\/start/, msg => {
  const text =  '<b>Привет)</b> 🙋‍♂️ Я бот, который меряет болты.🔩\n\n' +
                '📏 Чтобы <b>померять</b> болты участников, введи команду <b>/stats</b>.\n\n' +
                '🆕 <b>Изменить длину</b> болта можно командой <b>/dick</b> (рандомно от -5 см до +10 см). Эта команда работает раз в сутки.\n\n' +
                '👨‍👩‍👧‍👦 Бот работает только в <b>группах</b>.\n\n' +
                '❓❔ Есть <b>вопросы</b>? Пропиши <b>/help</b>.';

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML'
  })
})

// Вырастить/уменьшить болт
bot.onText(/\/dick/, async msg => {
  try {
    // Если сообщение отправлено в ЛС, то говорим пользователю, что бот работает только в группах
    if (!(msg.chat.type == 'group' || msg.chat.type == 'supergroup')) {
      bot.sendMessage(msg.chat.id, 'Я работаю только в <b>группах</b>', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Добавить бота в группу',
                url: 't.me/BoltMeterBot?startgroup=true'
              }
            ]
          ]
        }
      })

      return
    }

    let user;

    // Проверяем, есть ли такой пользователь в БД.
    user = await User.findOne({userId: msg.from.id, chatId: msg.chat.id})

    // Если нет - добавляем его туда
    if (user === null) {
      await User.create({userId: msg.from.id, chatId: msg.chat.id, length: 0})
    }

    // Проверяем, играл ли пользователь сегодня
    user = await User.findOne({userId: msg.from.id, chatId: msg.chat.id})

    let text

    // Если нет, меняем длинну болта и дату последней игры
    if (user.dateOfLastGame === undefined || (Date.now() > Date.parse(user.dateOfLastGame) + 1000 * 60 * 60 * 24)) {
      let changeInBoltLength
      if (user.length == 0) {
        changeInBoltLength = Math.floor(Math.random() * 10 + 1)
      } else {
        changeInBoltLength = Math.floor(Math.random() * 16 - 5)
      }

      let oldLength = user.length

      if (user.length + changeInBoltLength < 0) {
        newLength = 0
      } else {
        newLength = user.length + changeInBoltLength;
      }

      await User.updateOne({userId: msg.from.id, chatId: msg.chat.id}, {length: newLength, dateOfLastGame: new Date()})
      user = await User.findOne({userId: msg.from.id, chatId: msg.chat.id})

      let change
      if (newLength - oldLength >= 0) {
        change = 'вырос'
      } else {
        change = 'уменьшился'
      }

      text =  `🔩 Твой болт ${change} на <b>${Math.abs(newLength - oldLength)} см</b>.\n\n` +
              `🧮 Теперь он равен <b>${user.length} см</b>.\n\n` +
              '📆 Следующая попытка <b>завтра</b>!'

    // Если да
    } else {
      text =  `🎮 Ты уже <b>играл</b>.\n\n` +
              `🧮 Сейчас он равен <b>${user.length} см</b>.\n\n` +
              '📆 Следующая попытка <b>завтра</b>!'
    }

    // Пишем сообщение
    bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML'
    })
  } catch (e) {
    console.log(e);
  }
})

// Статистика
bot.onText(/\/stats/, async msg => {
  try {
    // Если сообщение отправлено в ЛС, то говорим пользователю, что бот работает только в группах
    if (!(msg.chat.type == 'group' || msg.chat.type == 'supergroup')) {
      bot.sendMessage(msg.chat.id, 'Я работаю только в <b>группах</b>', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Добавить бота в группу',
                url: 't.me/BoltMeterBot?startgroup=true'
              }
            ]
          ]
        }
      })

      return
    }

    // Достаем всех пользователей-игроков чата
    let users = await User.find({chatId: msg.chat.id})

    // Добавляем пользователям их имена
    for (let i = 0; i < users.length; i++) {
      let chatMember = await bot.getChatMember(users[i].chatId, users[i].userId)

      if (chatMember.user.last_name === undefined) {
        users[i].title = `${users[i].length} см - ${chatMember.user.first_name}`;
      } else {
        users[i].title = `${users[i].length} см - ${chatMember.user.first_name} ${chatMember.user.last_name}`
      }
    }

    // Сортируем пользоватлей
    users.sort((user1, user2) => user1.length - user2.length).reverse()

    // Рисуем диаграмму
    const configuration = {
      type: 'pie',
      data: {
        labels: users.map(user => user.title),
        datasets: [
          {
            data: users.map(user => user.length),
            backgroundColor: [  'rgb(255, 99, 132)',
                                'rgb(255, 159, 64)',
                                'rgb(255, 205, 86)',
                                'rgb(75, 192, 192)',
                                'rgb(54, 162, 235)',
                                'rgb(153, 102, 255)',
                                'rgb(201, 203, 207)'  ],
            cutout: 35,
            radius: 180,
          }
        ]
      },
      options: {
        plugins: {
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          },
          title: {
            display: true,
            text: `Создал бот - @${(await bot.getMe()).username}`,
            padding: {
              bottom: 40
            },
            font: {
              size: 20
            }
          },
          datalabels: {
            formatter: (value, ctx) => {
              let sum = 0
              let dataArr = ctx.chart.data.datasets[0].data
              dataArr.map(data => {
                sum += data;
              })
              let percentage = (value*100 / sum).toFixed(2)+"%"
              return percentage
            },
            color: '#fff',
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        },
        layout: {
          padding: 50
        }
      }
    };
    let image = await chartJSNodeCanvas.renderToBuffer(configuration);

    // Отправляем картинку-диаграмму
    bot.sendPhoto(msg.chat.id, image)
  } catch (e) {
    console.log(e);
  }
})

// Помощь
bot.onText(/\/help/, msg => {
  const text =  '💻 <b>Команды:</b>\n' +
                '<b>/dick</b> - Вырастить/уменьшить болт\n' +
                '<b>/stats</b> - Статистика\n' +
                '<b>/help</b> - Помощь\n\n' +
                '👨‍👩‍👧‍👦 Бот работает только в <b>группах</b>.\n\n' +
                '🖋<b>Канал автора</b>? - @alexal_blog';

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML'
  })
})

// Когда бота добавляют в группу
bot.on('new_chat_members', async msg => {
  if (msg.new_chat_participant.id === keys.BOT_ID) {
    await User.updateMany({chatId: msg.chat.id}, {inTheSameChatWithTheBot: true})

    const text =  '<b>Привет)</b> 🙋‍♂️ Я бот, который меряет болты.🔩\n\n' +
                  '📏 Чтобы <b>померять</b> болты участников, введи команду <b>/stats</b>.\n\n' +
                  '🆕 <b>Изменить длину</b> болта можно командой <b>/dick</b> (рандомно от -5 см до +10 см). Эта команда работает раз в сутки.\n\n' +
                  '👨‍👩‍👧‍👦 Бот работает только в <b>группах</b>.\n\n' +
                  '❓❔ Есть <b>вопросы</b>? Пропиши <b>/help.</b>'

    bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML'
    })
  }
})

// Когда бота удаляют из группы
bot.on('left_chat_member', async msg => {
  if (msg.left_chat_participant.id === keys.BOT_ID) {
    await User.updateMany({chatId: msg.chat.id}, {inTheSameChatWithTheBot: false})
  }
})
