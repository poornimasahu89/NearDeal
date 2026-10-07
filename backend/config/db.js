const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await backfillAccountStatus();
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

/**
 * Accounts written before `status` existed read as ACTIVE through Mongoose's
 * schema default, but every raw query — admin metrics, the user roster's
 * active/suspended filter, moderation counts — matches on the stored field and
 * would simply not see them. Persisting the default once, at start-up, makes
 * the stored documents agree with what the API already reports.
 *
 * This only adds the missing default; no existing value is ever overwritten
 * (a suspended account stays suspended).
 */
const backfillAccountStatus = async () => {
  const result = await User.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'ACTIVE' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`Backfilled account status on ${result.modifiedCount} user account(s)`);
  }
};

module.exports = connectDB;
