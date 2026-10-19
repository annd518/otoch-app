import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { OrderCard } from '../../components/OrderCard'
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from '../../components/ScreenState'
import { useSession } from '../../context/SessionContext'
import { theme } from '../../design/theme'
import { useOrders } from '../../hooks/useOrders'
import { sortForNurse } from '../../utils/orderView'

export default function CallsScreen() {
  const { user } = useSession()
  const router = useRouter()
  const { orders, state, error, refreshing, loadingMore, hasMore, refresh, loadMore } = useOrders()

  // Reload whenever the tab comes back into focus (e.g. after finishing an order).
  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh]),
  )

  const sorted = useMemo(() => sortForNurse(orders), [orders])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <FlatList
        data={state === 'ready' ? sorted : []}
        keyExtractor={(order) => order.id}
        contentContainerStyle={{ padding: theme.space[3], gap: theme.space[2], flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} />}
        ListHeaderComponent={
          <View style={{ gap: theme.space[2], paddingBottom: theme.space[1] }}>
            <AppText variant="heading" color={theme.color.navy}>
              Сайн байна уу, {user?.name}
            </AppText>
            {state === 'ready' && error ? <OfflineBanner message={`${error} Хадгалагдсан мэдээллийг харуулж байна.`} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          state === 'loading' ? (
            <Skeleton />
          ) : state === 'error' ? (
            <ErrorState message={error ?? ''} onRetry={() => void refresh()} />
          ) : (
            <EmptyState title="Томилогдсон дуудлага алга" hint="Шинэ дуудлага томилогдоход энд харагдана. Доош татаж шинэчилнэ үү." />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={theme.color.brand} />
          ) : hasMore ? (
            <Button label="Дараагийн дуудлагууд" variant="secondary" onPress={() => void loadMore()} />
          ) : null
        }
      />
    </SafeAreaView>
  )
}
