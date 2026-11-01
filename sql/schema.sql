PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS agencies(id TEXT PRIMARY KEY,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',phone TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',lat REAL,lng REAL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,CHECK((lat IS NULL)=(lng IS NULL)),CHECK(lat IS NULL OR lat BETWEEN -90 AND 90),CHECK(lng IS NULL OR lng BETWEEN -180 AND 180));
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,agency_id TEXT REFERENCES agencies(id));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS properties(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES agencies(id),title TEXT NOT NULL,intent TEXT NOT NULL,type TEXT NOT NULL,price REAL NOT NULL,beds INTEGER NOT NULL,baths INTEGER NOT NULL,area REAL NOT NULL,locality TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,description TEXT NOT NULL,amenities TEXT NOT NULL,images TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',floor_number INTEGER NOT NULL DEFAULT 0 CHECK(floor_number BETWEEN 0 AND 200),total_floors INTEGER CHECK(total_floors BETWEEN 1 AND 200),car_parking INTEGER NOT NULL DEFAULT 0 CHECK(car_parking BETWEEN 0 AND 100),two_wheeler_parking INTEGER NOT NULL DEFAULT 0 CHECK(two_wheeler_parking BETWEEN 0 AND 100),furnishing TEXT NOT NULL DEFAULT 'unfurnished' CHECK(furnishing IN ('furnished','semi_furnished','unfurnished','not_applicable')),age_years INTEGER CHECK(age_years BETWEEN 0 AND 200),created_at TEXT DEFAULT CURRENT_TIMESTAMP,CHECK(total_floors IS NULL OR floor_number<=total_floors));
    CREATE TABLE IF NOT EXISTS uploads(name TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES agencies(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES agencies(id),property_id TEXT REFERENCES properties(id),name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL,intent TEXT NOT NULL,requirements TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',notes TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,agency_id TEXT REFERENCES agencies(id),actor TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS throttles(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_agencies_status_created ON agencies(status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_agency_role ON users(agency_id,role);
    CREATE INDEX IF NOT EXISTS idx_properties_agency_created ON properties(agency_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_properties_status_created ON properties(status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_agency_created ON leads(agency_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_agency_created ON activity(agency_id,created_at DESC);
CREATE TRIGGER IF NOT EXISTS users_role_insert BEFORE INSERT ON users
WHEN NEW.role NOT IN ('super_admin','agency_admin','agent')
 OR (NEW.role='super_admin' AND NEW.agency_id IS NOT NULL)
 OR (NEW.role IN ('agency_admin','agent') AND NEW.agency_id IS NULL)
BEGIN SELECT RAISE(ABORT,'Invalid role or agency membership'); END;

UPDATE agencies SET status='active' WHERE status='pending';

CREATE TRIGGER IF NOT EXISTS users_role_update BEFORE UPDATE OF role,agency_id ON users
WHEN NEW.role NOT IN ('super_admin','agency_admin','agent')
 OR (NEW.role='super_admin' AND NEW.agency_id IS NOT NULL)
 OR (NEW.role IN ('agency_admin','agent') AND NEW.agency_id IS NULL)
BEGIN SELECT RAISE(ABORT,'Invalid role or agency membership'); END;
