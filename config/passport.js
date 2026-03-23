const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${process.env.SERVER_URL}/api/auth/google/callback`,
      scope:        ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email  = profile.emails[0].value;
        const avatar = profile.photos[0]?.value;

        // Kiểm tra user đã tồn tại chưa TRƯỚC KHI upsert
        const existingUser = await User.findOne({ googleId: profile.id });
        const isNewUser    = !existingUser;

        // Upsert — tạo mới nếu chưa có
        const user = await User.findOneAndUpdate(
          { googleId: profile.id },
          {
            $setOnInsert: {
              // Chỉ set khi tạo mới
              email,
              role:     'user',   // tất cả đều là 'user', không phân biệt buyer/seller
              isNewUser: true,
            },
            $set: {
              // Luôn cập nhật từ Google mỗi lần login
              googleId: profile.id,
              name:     profile.displayName,
              avatar,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        // Đính thêm flag để controller đọc
        user._isNewUser = isNewUser;

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done)   => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
