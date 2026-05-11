import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack>
      <Stack.Screen name="trips" options={{ title: 'My Trips' }} />
    </Stack>
  );
}
