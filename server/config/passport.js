const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy

const User = require('../models/User')

const isGoogleOAuthConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.CLIENT_URL)

const configurePassport = () => {
  if (!isGoogleOAuthConfigured()) {
    return false
  }

  const normalizedAdminEmails = new Set(
    [
      'academicanalyzer@gmail.com',
      ...String(process.env.GOOGLE_ADMIN_EMAILS || process.env.ADMIN1_EMAIL || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ]
  )

  const isAllowedGoogleEmail = (email) => normalizedAdminEmails.has(String(email || '').toLowerCase())

  const roleForEmail = (email) =>
    normalizedAdminEmails.has(email.toLowerCase()) ? 'admin' : 'student'

  const toBaseUsername = (value) =>
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^[._-]+|[._-]+$/g, '')

  const uniqueUsername = async (seedValue) => {
    const base = toBaseUsername(seedValue) || 'user'
    let candidate = base
    let suffix = 1
    while (await User.exists({ username: candidate })) {
      suffix += 1
      candidate = `${base}${suffix}`
    }
    return candidate
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value
          if (!email) {
            return done(new Error('Google account email is missing'))
          }

          if (!isAllowedGoogleEmail(email)) {
            return done(null, false, { message: 'This Google account is not allowed to sign in.' })
          }

          const existing = await User.findOne({ email: email.toLowerCase() })
          if (existing) {
            existing.provider = 'google'
            existing.providerId = profile.id
            existing.role = roleForEmail(email)
            await existing.save()
            return done(null, existing)
          }

          const username = await uniqueUsername(email.split('@')[0])
          const user = await User.create({
            name: profile.displayName || 'Google User',
            username,
            email: email.toLowerCase(),
            role: roleForEmail(email),
            provider: 'google',
            providerId: profile.id,
          })

          return done(null, user)
        } catch (error) {
          return done(error)
        }
      }
    )
  )

  return true
}

module.exports = { configurePassport, isGoogleOAuthConfigured }
