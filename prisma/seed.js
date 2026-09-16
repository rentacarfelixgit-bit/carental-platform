// prisma/seed.js
// Datos de prueba para desarrollo — corre con: npm run db:seed
// Usa Supabase Admin API (service role key) para crear usuarios en Auth.
//
// NOTA: Ejecuta DESPUES de:
//   1. npx prisma migrate dev
//   2. Ejecutar supabase_production_setup.sql en el SQL Editor de Supabase

'use strict'

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// --- Cargar .env.local manualmente -------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local no encontrado')
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

// Cliente con service role — acceso completo, sin RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- Helpers -----------------------------------------------------------------
function ok(label, data, error) {
  if (error) { console.error(`ERROR  ${label}: ${error.message}`); process.exit(1) }
  console.log(`OK     ${label}`)
  return data
}

async function createAuthUser(email, password, fullName) {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find(u => u.email === email)
  if (existing) {
    console.log(`INFO   Usuario ya existe: ${email}`)
    return existing.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  ok(`Auth user: ${email}`, data, error)
  return data.user.id
}

// --- MAIN --------------------------------------------------------------------
async function main() {
  console.log('\nIniciando seed de datos de prueba...\n')

  const ts  = new Date().toISOString()
  const now = ts

  const d = (offsetDays) => {
    const dt = new Date(now)
    dt.setDate(dt.getDate() + offsetDays)
    return dt.toISOString()
  }

  // ==========================================================================
  // 1. TENANT
  // ==========================================================================
  let tenantId

  const { data: existingTenant } = await supabase
    .from('tenants').select('id').eq('slug', 'felix-castillo').maybeSingle()

  if (existingTenant) {
    tenantId = existingTenant.id
    console.log(`INFO   Tenant ya existe: ${tenantId}`)
    // Asegura que el timezone esté actualizado aunque el tenant ya existiera
    await supabase.from('tenants').update({ timezone: 'America/Santo_Domingo' }).eq('id', tenantId)
  } else {
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: 'Felix Castillo Car Rental',
        slug: 'felix-castillo',
        plan: 'standard',
        timezone: 'America/Santo_Domingo',
        active: true,
        settings: {
          logo_url: null,
          primary_color: '#1e40af',
          timezone: 'America/Santo_Domingo',
          address: 'Aeropuerto Internacional del Cibao, Uveral, Licey al Medio',
          phone: '829-864-3074',
          rnc: '131754092',
          email: 'reservacionrentcar@gmail.com',
          city: 'Santiago',
        },
      })
      .select('id')
      .single()
    ok('Tenant creado', tenant, tenantErr)
    tenantId = tenant.id
  }

  // ==========================================================================
  // 2. USUARIOS AUTH + tabla users
  // ==========================================================================
  console.log('\nCreando usuarios...')
  const adminId    = await createAuthUser('felix@felixcarrental.com', 'Test1234!', 'Felix Castillo')
  const operatorId = await createAuthUser('juan@felixcarrental.com',  'Test1234!', 'Juan Perez')

  const { error: usersErr } = await supabase.from('users').upsert([
    { id: adminId,    tenant_id: tenantId, email: 'felix@felixcarrental.com', full_name: 'Felix Castillo', role: 'admin',    active: true, created_at: now, updated_at: now },
    { id: operatorId, tenant_id: tenantId, email: 'juan@felixcarrental.com',  full_name: 'Juan Perez',     role: 'operator', active: true, created_at: now, updated_at: now },
  ], { onConflict: 'id' })
  ok('Usuarios en tabla users', null, usersErr)

  // ==========================================================================
  // 3. VEHICULOS
  // ==========================================================================
  console.log('\nCreando vehiculos...')
  const { data: existingVehicles } = await supabase
    .from('vehicles').select('plates').eq('tenant_id', tenantId)
  const existingPlates = new Set((existingVehicles ?? []).map(v => v.plates))

  const vehiclesData = [
    { plates: 'A123456', brand: 'Toyota',    model: 'Corolla', year: 2022, color: 'Blanco', vin: 'JTDBR32E520123456', status: 'available' },
    { plates: 'B789012', brand: 'Honda',     model: 'Civic',   year: 2021, color: 'Negro',  vin: 'JHMFA36207S789012', status: 'available' },
    { plates: 'C345678', brand: 'Kia',       model: 'Rio',     year: 2023, color: 'Gris',   vin: 'KNADH4A39D6345678', status: 'available' },
    { plates: 'D901234', brand: 'Hyundai',   model: 'Accent',  year: 2022, color: 'Azul',   vin: 'KMHCT4AE8EU901234', status: 'available' },
    { plates: 'E567890', brand: 'Chevrolet', model: 'Aveo',    year: 2020, color: 'Rojo',   vin: 'KL1TF55647B567890', status: 'maintenance' },
  ]

  const newVehicles = vehiclesData.filter(v => !existingPlates.has(v.plates))
  let vehicleIds = {}

  if (newVehicles.length > 0) {
    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles')
      .insert(newVehicles.map(v => ({ ...v, tenant_id: tenantId, created_at: ts, updated_at: ts })))
      .select('id, plates')
    ok(`Vehiculos creados (${newVehicles.length})`, vehicles, vErr)
    vehicles.forEach(v => { vehicleIds[v.plates] = v.id })
  } else {
    console.log('INFO   Vehiculos ya existen')
  }

  const { data: allVehicles } = await supabase
    .from('vehicles').select('id, plates').eq('tenant_id', tenantId)
  allVehicles.forEach(v => { vehicleIds[v.plates] = v.id })

  // ==========================================================================
  // 4. CLIENTES
  // ==========================================================================
  console.log('\nCreando clientes...')
  const { data: existingClients } = await supabase
    .from('clients').select('id_number').eq('tenant_id', tenantId)
  const existingIds = new Set((existingClients ?? []).map(c => c.id_number))

  const clientsData = [
    {
      full_name: 'Oscar Almonte', id_type: 'license', id_number: '12674856',
      license_number: '12674856', license_expiry: '2026-09-15',
      phone: '809-555-1001', phone_2: '829-555-1002',
      email: 'oscar.almonte@email.com',
      address: 'Av. 27 de Febrero #45', city: 'Santiago', state: 'Santiago', zip_code: '51000',
    },
    {
      full_name: 'Maria Garcia', id_type: 'passport', id_number: 'US1234567',
      license_number: 'FL-DL-789456', license_expiry: '2027-03-20',
      phone: '+1-305-555-2001',
      email: 'mgarcia@email.com',
      address: '1234 Coral Way', city: 'Miami', state: 'FL', zip_code: '33145',
    },
    {
      full_name: 'Carlos Rodriguez', id_type: 'license', id_number: '40223178',
      license_number: '40223178', license_expiry: '2025-06-30',
      phone: '849-555-3001', phone_2: '849-555-3002',
      email: 'crodriguez@email.com',
      city: 'Puerto Plata', state: 'Puerto Plata',
    },
    {
      full_name: 'Jennifer Smith', id_type: 'passport', id_number: 'CA9876543',
      license_number: 'ON-DL-123789', license_expiry: '2028-11-10',
      phone: '+1-416-555-4001',
      email: 'jsmith@email.com',
      address: '500 Bay Street', city: 'Toronto', state: 'ON', zip_code: 'M5H 2Y4',
    },
  ]

  const newClients = clientsData.filter(c => !existingIds.has(c.id_number))
  let clientIds = {}

  if (newClients.length > 0) {
    const { data: clients, error: cErr } = await supabase
      .from('clients')
      .insert(newClients.map(c => ({ ...c, tenant_id: tenantId, created_by: adminId, created_at: ts, updated_at: ts })))
      .select('id, id_number')
    ok(`Clientes creados (${newClients.length})`, clients, cErr)
    clients.forEach(c => { clientIds[c.id_number] = c.id })
  } else {
    console.log('INFO   Clientes ya existen')
  }

  const { data: allClients } = await supabase
    .from('clients').select('id, id_number').eq('tenant_id', tenantId)
  allClients.forEach(c => { clientIds[c.id_number] = c.id })

  // ==========================================================================
  // 5. RESERVAS
  // ==========================================================================
  console.log('\nCreando reservas...')

  const reservationsData = [
    {
      client_id:    clientIds['12674856'],
      vehicle_id:   vehicleIds['A123456'],
      start_date:   d(-12),
      end_date:     d(-5),
      status:       'completed',
      daily_rate:   35.00,
      deposit:      150.00,
      exchange_rate: 58.50,
      payment_method: 'card',
      insurance_cdw_accepted: true,  insurance_cdw_price: 12.00,
      insurance_lia_accepted: true,  insurance_lia_price: 8.00,
      insurance_tw_accepted:  false,
      insurance_at_accepted:  false,
      station: 'Aeropuerto Internacional del Cibao',
      notes: 'Cliente frecuente. Viaje de negocios.',
      created_by: adminId, confirmed_by: adminId, confirmed_at: d(-13),
    },
    {
      client_id:    clientIds['US1234567'],
      vehicle_id:   vehicleIds['B789012'],
      start_date:   d(-2),
      end_date:     d(5),
      status:       'active',
      daily_rate:   40.00,
      deposit:      200.00,
      exchange_rate: 58.75,
      payment_method: 'cash',
      insurance_cdw_accepted: true,  insurance_cdw_price: 12.00,
      insurance_lia_accepted: true,  insurance_lia_price: 8.00,
      insurance_tw_accepted:  true,  insurance_tw_price: 5.00,
      insurance_at_accepted:  true,  insurance_at_price: 5.00,
      driver_age: 34,
      station: 'Aeropuerto Internacional del Cibao',
      notes: 'Turista. Primera visita a la Republica Dominicana.',
      created_by: operatorId, confirmed_by: adminId, confirmed_at: d(-3),
    },
    {
      client_id:    clientIds['CA9876543'],
      vehicle_id:   vehicleIds['C345678'],
      start_date:   d(3),
      end_date:     d(10),
      status:       'pending',
      daily_rate:   32.00,
      deposit:      120.00,
      exchange_rate: 58.50,
      payment_method: 'card',
      driver_age: 41,
      client_has_pets: false,
      station: 'Aeropuerto Internacional del Cibao',
      notes: '',
      created_by: operatorId,
    },
  ]

  const { data: existingReservations } = await supabase
    .from('reservations').select('id').eq('tenant_id', tenantId)

  let allReservationsList = []

  if (!existingReservations || existingReservations.length === 0) {
    const { data: reservations, error: rErr } = await supabase
      .from('reservations')
      .insert(reservationsData.map(r => ({ ...r, tenant_id: tenantId, created_at: ts, updated_at: ts })))
      .select('id, status')
    ok(`Reservas creadas (${reservations.length})`, reservations, rErr)
    allReservationsList = reservations
  } else {
    console.log('INFO   Reservas ya existen')
    const { data: fetched } = await supabase
      .from('reservations').select('id, status').eq('tenant_id', tenantId)
    allReservationsList = fetched ?? []
  }

  // ==========================================================================
  // 6. EXTRAS
  // ==========================================================================
  console.log('\nCreando extras...')

  const completed = allReservationsList.find(r => r.status === 'completed')
  const active    = allReservationsList.find(r => r.status === 'active')

  const { data: existingExtras } = await supabase
    .from('reservation_extras').select('reservation_id')
  const existingExtraResIds = new Set((existingExtras ?? []).map(e => e.reservation_id))

  const extrasToInsert = []

  if (completed && !existingExtraResIds.has(completed.id)) {
    extrasToInsert.push(
      { reservation_id: completed.id, extra_type: 'gps',       price_per_day: 5.00 },
      { reservation_id: completed.id, extra_type: 'baby_seat', price_per_day: 6.00 },
    )
  }
  if (active && !existingExtraResIds.has(active.id)) {
    extrasToInsert.push(
      { reservation_id: active.id, extra_type: 'gps',          price_per_day: 5.00 },
      { reservation_id: active.id, extra_type: 'extra_driver', price_per_day: 0.00 },
    )
  }

  if (extrasToInsert.length > 0) {
    const { error: extErr } = await supabase.from('reservation_extras').insert(extrasToInsert)
    ok(`Extras creados (${extrasToInsert.length})`, null, extErr)
  } else {
    console.log('INFO   Extras ya existen')
  }

  // ==========================================================================
  // 7. INSPECCIONES
  // ==========================================================================
  console.log('\nCreando inspecciones...')

  const { data: existingInspections } = await supabase
    .from('inspections').select('reservation_id, type').eq('tenant_id', tenantId)
  const inspKey = (rid, type) => `${rid}:${type}`
  const existingInspSet = new Set((existingInspections ?? []).map(i => inspKey(i.reservation_id, i.type)))

  const inspectionsToInsert = []

  if (completed) {
    if (!existingInspSet.has(inspKey(completed.id, 'checkout'))) {
      inspectionsToInsert.push({
        tenant_id: tenantId, reservation_id: completed.id,
        type: 'checkout', odometer: 42350, fuel_level: 'full',
        notes: 'Vehiculo en perfectas condiciones al salir.',
        inspector_id: operatorId,
      })
    }
    if (!existingInspSet.has(inspKey(completed.id, 'checkin'))) {
      inspectionsToInsert.push({
        tenant_id: tenantId, reservation_id: completed.id,
        type: 'checkin', odometer: 42892, fuel_level: 'three_quarters',
        notes: 'Pequeno rayon en puerta trasera izquierda, previamente registrado.',
        inspector_id: operatorId,
      })
    }
  }

  if (active && !existingInspSet.has(inspKey(active.id, 'checkout'))) {
    inspectionsToInsert.push({
      tenant_id: tenantId, reservation_id: active.id,
      type: 'checkout', odometer: 28100, fuel_level: 'full',
      notes: 'Vehiculo entregado en perfectas condiciones.',
      inspector_id: operatorId,
    })
  }

  if (inspectionsToInsert.length > 0) {
    const { error: inErr } = await supabase.from('inspections').insert(inspectionsToInsert)
    ok(`Inspecciones creadas (${inspectionsToInsert.length})`, null, inErr)
  } else {
    console.log('INFO   Inspecciones ya existen')
  }

  // ==========================================================================
  // RESUMEN
  // ==========================================================================
  console.log('\n' + '-'.repeat(50))
  console.log('Seed completado.\n')
  console.log('Credenciales de prueba:')
  console.log('  Admin:    felix@felixcarrental.com  /  Test1234!')
  console.log('  Operator: juan@felixcarrental.com   /  Test1234!')
  console.log('\nDatos creados:')
  console.log('  1 tenant: Felix Castillo Car Rental')
  console.log('  2 usuarios (admin + operator)')
  console.log('  5 vehiculos (Toyota, Honda, Kia, Hyundai, Chevrolet)')
  console.log('  4 clientes (2 locales, 2 internacionales)')
  console.log('  3 reservas (completada, activa, pendiente)')
  console.log('  4 extras (GPS, baby seat, conductor adicional)')
  console.log('  3 inspecciones (checkout+checkin completada, checkout activa)')
  console.log('\nNOTA: Recuerda ejecutar supabase_production_setup.sql en Supabase SQL Editor.\n')
}

main().catch(err => {
  console.error('\nERROR en seed:', err.message)
  process.exit(1)
})
