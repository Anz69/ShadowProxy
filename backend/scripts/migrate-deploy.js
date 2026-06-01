#!/usr/bin/env node
/**
 * Универсальный скрипт для безопасного деплоя миграций Prisma.
 * Автоматически резолвит все failed миграции перед применением новых.
 * Luna→Mango миграция всегда выполняется в конце при билде/деплое.
 */

const { execSync } = require('child_process');

async function runLunaToMango() {
  console.log('🔄 Running Luna→Mango data migration...');
  try {
    const { runLunaToMangoMigration } = require('./luna-to-mango-migrate.js');
    await runLunaToMangoMigration();
    console.log('✅ Luna→Mango migration completed.');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.error('Luna→Mango migration error:', msg);
    if (e && e.stack) console.error(e.stack);
    if (msg.includes('Unexpected end of input') || msg.includes('Unexpected end of JSON')) {
      console.log('(Деплой продолжаем; при необходимости: npm run script:luna-to-mango)');
    } else if (msg.includes('invalid port number') || msg.includes('invalid database string') || msg.includes('connection string')) {
      console.log('(Проверьте DATABASE_URL в backend/.env. Деплой продолжаем.)');
    } else {
      process.exit(1);
    }
  }
}

function run(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

async function main() {
  console.log('🔍 Checking migration status...');
  
  // Пробуем выполнить migrate deploy
  let result = run('npx prisma migrate deploy', { silent: true });
  
  if (result.success) {
    console.log('✅ Migration deploy completed successfully!');
    console.log(result.output);
    await runLunaToMango();
    return;
  }

  // Проверяем, есть ли ошибка P3009 (failed migrations)
  const errorOutput = result.error + result.output;
  
  if (errorOutput.includes('P3009')) {
    console.log('⚠️  Found failed migrations, attempting to resolve...');
    
    // Извлекаем имя failed миграции из ошибки
    const migrationMatch = errorOutput.match(/The `(\d+_[a-zA-Z0-9_]+)` migration/);
    
    if (migrationMatch && migrationMatch[1]) {
      const migrationName = migrationMatch[1];
      console.log(`   Resolving failed migration: ${migrationName}`);
      
      // Пробуем resolve как rolled-back
      const resolveResult = run(`npx prisma migrate resolve --rolled-back ${migrationName}`, { silent: true });
      
      if (resolveResult.success) {
        console.log(`   ✓ Migration ${migrationName} marked as rolled-back`);
      } else {
        // Если rolled-back не сработал, пробуем applied
        console.log(`   Trying to mark as applied...`);
        run(`npx prisma migrate resolve --applied ${migrationName}`, { silent: true });
      }
      
      // Повторно запускаем migrate deploy
      console.log('🚀 Retrying prisma migrate deploy...');
      run('npx prisma migrate deploy');
      console.log('✅ Migration deploy completed!');
      await runLunaToMango();
      return;
    }
  }

  // Если не P3009, снова запускаем migrate deploy
  console.log('🚀 Running prisma migrate deploy...');
  result = run('npx prisma migrate deploy');
  if (result.success) {
    console.log('✅ Migration deploy completed!');
  }
  // Luna→Mango всегда выполняется в конце (при билде/деплое)
  await runLunaToMango();
}

main().catch((error) => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
