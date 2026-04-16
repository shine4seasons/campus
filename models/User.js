const mongoose = require('mongoose');
const { USER_ROLES } = require('../config/appConstants');


const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    name:     { type: String, required: true },
    avatar:   { type: String, default: null },

    // Không phân biệt buyer / seller
    // Một tài khoản vừa mua vừa bán — chỉ có 'user' và 'admin'
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },

    // ── Onboarding (step 2 sau khi đăng nhập lần đầu) ─
    nickname:        { type: String, default: '' },
    phone:           { type: String, default: '' },
    university:      { type: String, default: '' },
    studentId:       { type: String, default: '' },
    bio:             { type: String, default: '', maxlength: 200 },
    profileComplete: { type: Boolean, default: false },

    // true khi vừa tạo tài khoản — callback đọc để redirect step 2
    isNewUser: { type: Boolean, default: true },

    // Admin controls
    banned: { type: Boolean, default: false, index: true },

    // ── Stats ──────────────────────────────────────────
    rating:      { type: Number, default: 5.0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    totalSales:  { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },

    // ── Location (Map feature) ─────────────────────────
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

UserSchema.virtual('displayName').get(function () {
  return this.nickname || this.name;
});

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.googleId;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
