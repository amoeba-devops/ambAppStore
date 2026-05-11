import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getAccessToken } from '../lib/api-client';

export default function Index() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getAccessToken().then((t) => setAuthed(Boolean(t)));
  }, []);

  if (authed === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return authed ? <Redirect href="/(driver)/trips" /> : <Redirect href="/(auth)/login" />;
}
