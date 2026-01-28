
// Configure Sharding for user-service
// Database: userservice

var dbName = "userservice";
var db = db.getSiblingDB(dbName);

print("Switching to database: " + dbName);

// Helper to safely create collection
function safeCreateCollection(name) {
    try {
        db.createCollection(name);
        print("Created collection: " + name);
    } catch (e) {
        print("Collection already exists: " + name);
    }
}

// 1. Users
print("Configuring users...");
try { db.users.drop(); print("Dropped users collection"); } catch (e) { }
safeCreateCollection("users");
try {
    db.users.createIndex({ "tenantId": 1, "email": 1 }, { unique: true });
    print("Created index for users");
} catch (e) { print("Index creation error: " + e); }

try {
    sh.shardCollection(dbName + ".users", { "tenantId": 1 });
    print("Sharded users");
} catch (e) { print("Sharding users error: " + e); }


// 2. Roles
print("Configuring roles...");
try { db.roles.drop(); print("Dropped roles collection"); } catch (e) { }
safeCreateCollection("roles");
try {
    db.roles.createIndex({ "tenantId": 1, "name": 1 }, { unique: true });
    print("Created index for roles");
} catch (e) { print("Index creation error: " + e); }

try {
    sh.shardCollection(dbName + ".roles", { "tenantId": 1 });
    print("Sharded roles");
} catch (e) { print("Sharding roles error: " + e); }


// 3. Permissions
print("Configuring permissions...");
try { db.permissions.drop(); print("Dropped permissions collection"); } catch (e) { }
safeCreateCollection("permissions");
try {
    db.permissions.createIndex({ "tenantId": 1, "resource": 1, "action": 1 }, { unique: true });
    print("Created index for permissions");
} catch (e) { print("Index creation error: " + e); }

try {
    sh.shardCollection(dbName + ".permissions", { "tenantId": 1 });
    print("Sharded permissions");
} catch (e) { print("Sharding permissions error: " + e); }


// 4. Tenants
print("Configuring tenants...");
try { db.tenants.drop(); print("Dropped tenants collection"); } catch (e) { }
safeCreateCollection("tenants");
try {
    db.tenants.createIndex({ "tenantId": 1 }, { unique: true });
    print("Created index for tenants");
} catch (e) { print("Index creation error: " + e); }

try {
    sh.shardCollection(dbName + ".tenants", { "tenantId": 1 });
    print("Sharded tenants");
} catch (e) { print("Sharding tenants error: " + e); }

print("Configuration complete.");
