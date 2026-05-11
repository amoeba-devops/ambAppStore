import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { logout } from '../../lib/auth';

export default function TripsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('driver.myTrips')}</Text>
      <Text style={styles.empty}>{t('driver.noTrips')}</Text>
      <Pressable onPress={onLogout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>{t('auth.logout')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f7f8fa' },
  title: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  empty: { marginTop: 16, color: '#64748b' },
  logoutBtn: {
    marginTop: 'auto',
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  logoutText: { color: '#0f172a' },
});
