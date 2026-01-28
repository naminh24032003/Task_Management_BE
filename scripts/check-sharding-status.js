
print("Checking userservice sharding status...");
var db = db.getSiblingDB("userservice");

print("Collections:");
db.getCollectionNames().forEach(function (c) {
    print(" - " + c + ": " + db.getCollection(c).countDocuments() + " docs");
});

print("\n--- Shard Distribution ---");
try {
    print("Users:");
    db.users.getShardDistribution();
} catch (e) { print("Users not sharded or empty: " + e); }

try {
    print("\nRoles:");
    db.roles.getShardDistribution();
} catch (e) { print("Roles not sharded or empty: " + e); }

try {
    print("\nPermissions:");
    db.permissions.getShardDistribution();
} catch (e) { print("Permissions not sharded or empty: " + e); }

try {
    print("\nTenants:");
    db.tenants.getShardDistribution();
} catch (e) { print("Tenants not sharded or empty: " + e); }
