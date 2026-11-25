-- SQLite only. Generated locally; password values are scrypt hashes.
PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS agencies(id TEXT PRIMARY KEY,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,agency_id TEXT REFERENCES agencies(id));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS properties(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES agencies(id),title TEXT NOT NULL,intent TEXT NOT NULL,type TEXT NOT NULL,price REAL NOT NULL,beds INTEGER NOT NULL,baths INTEGER NOT NULL,area REAL NOT NULL,locality TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,description TEXT NOT NULL,amenities TEXT NOT NULL,images TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL REFERENCES agencies(id),property_id TEXT REFERENCES properties(id),name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL,intent TEXT NOT NULL,requirements TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',notes TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,agency_id TEXT REFERENCES agencies(id),actor TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS throttles(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS users_role_insert BEFORE INSERT ON users
WHEN NEW.role NOT IN ('super_admin','agency_admin','agent')
 OR (NEW.role='super_admin' AND NEW.agency_id IS NOT NULL)
 OR (NEW.role IN ('agency_admin','agent') AND NEW.agency_id IS NULL)
BEGIN SELECT RAISE(ABORT,'Invalid role or agency membership'); END;

CREATE TRIGGER IF NOT EXISTS users_role_update BEFORE UPDATE OF role,agency_id ON users
WHEN NEW.role NOT IN ('super_admin','agency_admin','agent')
 OR (NEW.role='super_admin' AND NEW.agency_id IS NOT NULL)
 OR (NEW.role IN ('agency_admin','agent') AND NEW.agency_id IS NULL)
BEGIN SELECT RAISE(ABORT,'Invalid role or agency membership'); END;

BEGIN IMMEDIATE;
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email='waseemakram060396@gmail.com');
INSERT INTO users(id,name,email,password,role,agency_id) VALUES('2b20abdb-292a-4447-9dc7-5fc3b58a2b8e','Waseem Akram','waseemakram060396@gmail.com','b33a3645904ca2c6b295e381b1cddf90:65a74c902c614a77b5d1566b767352ea8030ab55ec0c8aa20322b60ede95ca8980785033d184a4675770d3102b3912937cc516e6f5b8b4171156bb87d831f7e0','super_admin',NULL) ON CONFLICT(email) DO UPDATE SET name=excluded.name,password=excluded.password,role=excluded.role,agency_id=excluded.agency_id;
INSERT INTO agencies(id,name,status) VALUES('demo-agency-1','Demo Agency One','active') ON CONFLICT(id) DO UPDATE SET name=excluded.name,status='active';
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email='agency1@example.com');
INSERT INTO users(id,name,email,password,role,agency_id) VALUES('d8130d36-250f-488f-8145-d7956a160f3f','Demo Agency One','agency1@example.com','7798cb5573364a42fcd5d6f803021a0d:f1480e7f4898d01dfb8c752e3905e3ea5b50bbd2f52a0375aa181a695910141b82f491776371d312dd0e397297d9beb1af8dcfd6cd6901e513cfe2faddcfeb60','agency_admin','demo-agency-1') ON CONFLICT(email) DO UPDATE SET name=excluded.name,password=excluded.password,role=excluded.role,agency_id=excluded.agency_id;
INSERT INTO agencies(id,name,status) VALUES('demo-agency-2','Demo Agency Two','active') ON CONFLICT(id) DO UPDATE SET name=excluded.name,status='active';
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email='agency2@example.com');
INSERT INTO users(id,name,email,password,role,agency_id) VALUES('1e0ba6b8-c78d-4553-89c4-1cb40f00b802','Demo Agency Two','agency2@example.com','42978f10eb144610e4aec81e0044a429:5287b92c1dca09e8061c36c47aacd00c3254abf86444080027418b1cc5c7d894e910f3ac21d6f81ab46ec46a3864ca06f6c36e07ef7af314e43bba6e5a90eca5','agency_admin','demo-agency-2') ON CONFLICT(email) DO UPDATE SET name=excluded.name,password=excluded.password,role=excluded.role,agency_id=excluded.agency_id;
COMMIT;
