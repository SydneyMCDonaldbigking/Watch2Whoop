-- Preserve existing language choices and allow Japanese for profiles and app installs.
-- Consent language stays zh/en: Japanese UI currently displays the English consent document.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_language_check;
ALTER TABLE users ADD CONSTRAINT users_language_check CHECK (language IN ('zh', 'en', 'ja'));
COMMENT ON COLUMN users.language IS 'UI and AI reply language: zh / en / ja; NULL = follow the device language';

ALTER TABLE push_devices DROP CONSTRAINT IF EXISTS push_devices_lang_check;
ALTER TABLE push_devices ADD CONSTRAINT push_devices_lang_check CHECK (lang IN ('zh', 'en', 'ja'));
