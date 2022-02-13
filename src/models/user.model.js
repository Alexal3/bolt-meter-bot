const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema({
  userId: {
    type: Number,
    required: true
  },
  chatId: {
    type: Number,
    required: true
  },
  length: {
    type: Number,
    required: true
  },
  dateOfLastGame: {
    type: Date
  },
  inTheSameChatWithTheBot: {
    type: Boolean,
    required: true,
    default: true
  },
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: false
  }
})

mongoose.model('user', UserSchema)
