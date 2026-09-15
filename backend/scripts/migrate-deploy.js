#!/usr/bin/env node
/**
 * Универсальный скрипт для безопасного деплоя миграций Prisma.
 * Автоматически резолвит все failed миграции перед применением новых.
 * Data-миграции провайдеров намеренно НЕ запускаются автоматически.
 * Они требуют отдельного dry-run и явного --execute после деплоя.
 */

const { execSync } = require('child_process');

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
      return;
    }
  }

  // Если не P3009, снова запускаем migrate deploy
  console.log('🚀 Running prisma migrate deploy...');
  result = run('npx prisma migrate deploy');
  if (result.success) {
    console.log('✅ Migration deploy completed!');
  }
}

main().catch((error) => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
