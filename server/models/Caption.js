const mongoose = require('mongoose');

const CaptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  imageUrl: { type: String, required: true },
  imagePublicId: { type: String, default: null },
  caption: { type: String, required: true },
  hashtags: [String],
  tone: { type: String, default: 'neutral' },
  platform: { type: String, default: 'general' },
  brandVoice: { type: String, default: 'default' },
  altText: { type: String, default: '' },
  variants: {
    type: [
      {
        caption: { type: String, required: true },
        hashtags: [String],
      },
    ],
    default: [],
  },
  favorite: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Caption', CaptionSchema);
