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
        const email = profile.emails[0].value;
        const avatar = profile.photos[0]?.value;

        // Upsert — tạo mới nếu chưa có, cập nhật nếu đã có
        const user = await User.findOneAndUpdate(
          { googleId: profile.id },
          {
            $setOnInsert: { email, role: 'buyer' },
            $set: {
              googleId: profile.id,
              name:     profile.displayName,
              avatar,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Không dùng session — JWT stateless
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;