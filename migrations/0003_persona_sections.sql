-- Parsed job-description sections stored with each persona.
ALTER TABLE personas ADD COLUMN sections_json TEXT NOT NULL DEFAULT '{"expected":[],"goodToHave":[],"skills":[]}';
