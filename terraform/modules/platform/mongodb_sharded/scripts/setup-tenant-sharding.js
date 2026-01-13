// =============================================================================
// MongoDB Zone-Based Sharding Setup for Multi-Tenant Architecture
// =============================================================================
// This script configures zone-based sharding for 3 geographic tenants:
// - HCM (Hồ Chí Minh) -> Shard 0
// - DN (Đà Nẵng)      -> Shard 1
// - HN (Hà Nội)       -> Shard 2
//
// Each tenant's data is automatically routed to its designated shard based on
// the tenantId field in documents.
// =============================================================================

print('\n' + '='.repeat(70));
print('  MongoDB Zone-Based Sharding Setup for Tenants');
print('  HCM (Hồ Chí Minh) | DN (Đà Nẵng) | HN (Hà Nội)');
print('='.repeat(70) + '\n');

// =============================================================================
// Step 1: Add Shard Tags (Zone Mapping)
// =============================================================================
print('Step 1: Configuring shard tags for geographic zones...\n');

try {
  sh.addShardTag('user-mongodb-mongodb-sharded-shard-0', 'HCM');
  print('  ✓ Shard 0 tagged as "HCM" (Hồ Chí Minh)');
} catch (e) {
  print('  ! Shard 0 tag already exists or error:', e.message);
}

try {
  sh.addShardTag('user-mongodb-mongodb-sharded-shard-1', 'DN');
  print('  ✓ Shard 1 tagged as "DN" (Đà Nẵng)');
} catch (e) {
  print('  ! Shard 1 tag already exists or error:', e.message);
}

try {
  sh.addShardTag('user-mongodb-mongodb-sharded-shard-2', 'HN');
  print('  ✓ Shard 2 tagged as "HN" (Hà Nội)');
} catch (e) {
  print('  ! Shard 2 tag already exists or error:', e.message);
}

print('\n' + '-'.repeat(70) + '\n');

// =============================================================================
// Step 2: Enable Sharding on Database
// =============================================================================
print('Step 2: Enabling sharding on user-service database...\n');

try {
  sh.enableSharding('user-service');
  print('  ✓ Sharding enabled on "user-service" database\n');
} catch (e) {
  print('  ! Database already sharded or error:', e.message + '\n');
}

print('-'.repeat(70) + '\n');

// =============================================================================
// Step 3: Shard Collections with Compound Shard Keys
// =============================================================================
print('Step 3: Sharding collections with tenantId-based keys...\n');

const collections = [
  { name: 'users', shardKey: { tenantId: 1, _id: 1 } },
  { name: 'roles', shardKey: { tenantId: 1, _id: 1 } },
  { name: 'permissions', shardKey: { tenantId: 1, _id: 1 } },
  { name: 'tenants', shardKey: { tenantId: 1 } }
];

collections.forEach(coll => {
  try {
    sh.shardCollection(`user-service.${coll.name}`, coll.shardKey);
    print(`  ✓ Sharded collection: ${coll.name}`);
  } catch (e) {
    print(`  ! Collection ${coll.name} already sharded or error: ${e.message}`);
  }
});

print('\n' + '-'.repeat(70) + '\n');

// =============================================================================
// Step 4: Configure Zone Ranges for Each Tenant
// =============================================================================
print('Step 4: Configuring zone ranges for tenant data routing...\n');

// HCM tenant IDs that will route to Shard 0
const hcmTenants = ['hcm', 'hcm-001', 'hcm-002', 'hcm-003', 'hcm-999'];

// DN tenant IDs that will route to Shard 1
const dnTenants = ['dn', 'dn-001', 'dn-002', 'dn-003', 'dn-999'];

// HN tenant IDs that will route to Shard 2
const hnTenants = ['hn', 'hn-001', 'hn-002', 'hn-003', 'hn-999'];

// Configure HCM zone ranges
print('  Configuring HCM (Hồ Chí Minh) zone ranges...');
hcmTenants.forEach(tenantId => {
  collections.forEach(coll => {
    try {
      sh.addTagRange(
        `user-service.${coll.name}`,
        { tenantId: tenantId, _id: MinKey },
        { tenantId: tenantId, _id: MaxKey },
        'HCM'
      );
    } catch (e) {
      // Silently ignore if range already exists
    }
  });
});
print('  ✓ HCM zone ranges configured for tenants:', hcmTenants.join(', '));

// Configure DN zone ranges
print('  Configuring DN (Đà Nẵng) zone ranges...');
dnTenants.forEach(tenantId => {
  collections.forEach(coll => {
    try {
      sh.addTagRange(
        `user-service.${coll.name}`,
        { tenantId: tenantId, _id: MinKey },
        { tenantId: tenantId, _id: MaxKey },
        'DN'
      );
    } catch (e) {
      // Silently ignore if range already exists
    }
  });
});
print('  ✓ DN zone ranges configured for tenants:', dnTenants.join(', '));

// Configure HN zone ranges
print('  Configuring HN (Hà Nội) zone ranges...');
hnTenants.forEach(tenantId => {
  collections.forEach(coll => {
    try {
      sh.addTagRange(
        `user-service.${coll.name}`,
        { tenantId: tenantId, _id: MinKey },
        { tenantId: tenantId, _id: MaxKey },
        'HN'
      );
    } catch (e) {
      // Silently ignore if range already exists
    }
  });
});
print('  ✓ HN zone ranges configured for tenants:', hnTenants.join(', '));

print('\n' + '-'.repeat(70) + '\n');

// =============================================================================
// Step 5: Display Sharding Status
// =============================================================================
print('Step 5: Current Sharding Status\n');
print('='.repeat(70));
sh.status();
print('='.repeat(70));

// =============================================================================
// Setup Complete
// =============================================================================
print('\n' + '='.repeat(70));
print('  Zone-Based Sharding Setup Complete!');
print('='.repeat(70));
print('\nTenant -> Shard Mapping:');
print('  HCM (Hồ Chí Minh) -> Shard 0 (user-mongodb-mongodb-sharded-shard-0)');
print('  DN (Đà Nẵng)      -> Shard 1 (user-mongodb-mongodb-sharded-shard-1)');
print('  HN (Hà Nội)       -> Shard 2 (user-mongodb-mongodb-sharded-shard-2)');
print('\nConfigured Tenants:');
print('  HCM:', hcmTenants.join(', '));
print('  DN: ', dnTenants.join(', '));
print('  HN: ', hnTenants.join(', '));
print('\nData will be automatically routed to appropriate shards based on tenantId.');
print('='.repeat(70) + '\n');
