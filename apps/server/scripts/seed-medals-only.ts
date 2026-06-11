import { PrismaClient } from '@prisma/client';

interface MedalData {
  key: string;
  category: string;
  name: string;
  description: string;
  icon: string;
}

const MEDALS: MedalData[] = [
  // WINNING
  { key: 'WINS_3', category: 'WINNING', name: '3 Wins', description: 'Win 3 games in this class', icon: '🏆' },
  { key: 'WINS_10', category: 'WINNING', name: '10 Wins', description: 'Win 10 games in this class', icon: '🏆' },
  { key: 'WINS_50', category: 'WINNING', name: '50 Wins', description: 'Win 50 games in this class', icon: '👑' },
  { key: 'WINS_100', category: 'WINNING', name: '100 Wins', description: 'Win 100 games in this class', icon: '👑' },
  // STREAK (consecutive #1 finishes)
  { key: 'CONSEC_WIN_3', category: 'STREAK', name: '3 in a Row', description: 'Finish #1 three sessions in a row', icon: '🔥' },
  { key: 'CONSEC_WIN_5', category: 'STREAK', name: '5 in a Row', description: 'Finish #1 five sessions in a row', icon: '🔥' },
  { key: 'CONSEC_WIN_10', category: 'STREAK', name: '10 in a Row', description: 'Finish #1 ten sessions in a row', icon: '💥' },
  // LEADERBOARD
  { key: 'RANK1_WEEK', category: 'LEADERBOARD', name: 'Weekly #1', description: 'Hold the #1 weekly rank in class', icon: '📅' },
  { key: 'RANK1_MONTH', category: 'LEADERBOARD', name: 'Monthly #1', description: 'Hold the #1 monthly rank in class', icon: '📆' },
  // PARTICIPATION
  { key: 'GAMES_10', category: 'PARTICIPATION', name: '10 Games', description: 'Play 10 games in this class', icon: '🎮' },
  { key: 'GAMES_50', category: 'PARTICIPATION', name: '50 Games', description: 'Play 50 games in this class', icon: '🎮' },
  { key: 'GAMES_100', category: 'PARTICIPATION', name: '100 Games', description: 'Play 100 games in this class', icon: '🎮' },
  // ACCURACY
  { key: 'ACC_90', category: 'ACCURACY', name: '90% Accuracy', description: 'Achieve 90%+ accuracy in a session', icon: '🎯' },
  { key: 'ACC_95', category: 'ACCURACY', name: '95% Accuracy', description: 'Achieve 95%+ accuracy in a session', icon: '🎯' },
  { key: 'ACC_100', category: 'ACCURACY', name: 'Perfect!', description: 'Get every answer correct in a session', icon: '⭐' },
  // SPEED
  { key: 'SPEED_FAST', category: 'SPEED', name: 'Quick Thinker', description: 'Average response under 5s in a session', icon: '⚡' },
  { key: 'SPEED_LIGHTNING', category: 'SPEED', name: 'Lightning', description: 'Average response under 3s in a session', icon: '⚡' },
  { key: 'SPEED_DEMON', category: 'SPEED', name: 'Speed Demon', description: 'Avg response under 2s AND all correct in a session', icon: '🚀' },
];

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('Seeding medals...');
    let upsertCount = 0;

    for (const medal of MEDALS) {
      await prisma.gameMedal.upsert({
        where: { key: medal.key },
        create: medal as any,
        update: {
          name: medal.name,
          description: medal.description,
          icon: medal.icon,
          category: medal.category as any,
        },
      });
      upsertCount++;
    }

    console.log(`Successfully seeded ${upsertCount} medals`);

    // Verify medals were created
    const medalCount = await prisma.gameMedal.count();
    console.log(`Total medals in database: ${medalCount}`);

    // List all medals by category
    const medals = await prisma.gameMedal.findMany({
      orderBy: { category: 'asc' },
    });

    console.log('\nMedals by category:');
    let currentCategory = '';
    for (const m of medals) {
      if (m.category !== currentCategory) {
        currentCategory = m.category;
        console.log(`\n  ${currentCategory}:`);
      }
      console.log(`    - [${m.key}] ${m.icon} ${m.name}`);
    }
  } catch (error) {
    console.error('Error seeding medals:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
