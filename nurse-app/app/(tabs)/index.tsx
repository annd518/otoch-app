import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { ErrorBox } from '../../components/ErrorBox'
import { OfferCard } from '../../components/OfferCard'
import { OrderCard } from '../../components/OrderCard'
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from '../../components/ScreenState'
import { useSession } from '../../context/SessionContext'
import { theme } from '../../design/theme'
import { useOffers } from '../../hooks/useOffers'
import { useOrders } from '../../hooks/useOrders'
import { useProfile } from '../../hooks/useProfile'
import { sortForNurse } from '../../utils/orderView'

export default function CallsScreen() {
  const { user } = useSession()
  const router = useRouter()
  const { orders, state, error, refreshing, loadingMore, hasMore, refresh, loadMore } = useOrders()
  const [focused, setFocused] = useState(false)
  const offers = useOffers(focused)
  const profile = useProfile()
  const [offerMessage, setOfferMessage] = useState<string | null>(null)

  // Reload whenever the tab comes back into focus (e.g. after finishing an order);
  // offers are polled only while it is focused.
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      void refresh()
      void profile.load()
      return () => setFocused(false)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, profile.load]),
  )

  async function respond(id: string, kind: 'accept' | 'decline') {
    setOfferMessage(null)
    const outcome = await offers.respond(id, kind)
    if (!outcome.ok) setOfferMessage(outcome.message)
    else if (kind === 'accept' && outcome.order) {
      void refresh()
      router.push({ pathname: '/orders/[id]', params: { id: outcome.order.id } })
    }
  }

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
            {profile.profile !== undefined && !profile.profile?.isActive ? (
              <View
                style={{
                  gap: theme.space[1],
                  padding: theme.space[3],
                  borderRadius: theme.radius.card,
                  backgroundColor: theme.color.warningBg,
                }}
              >
                <AppText variant="label" color={theme.color.warning}>
                  Та идэвхгүй байна, шинэ дуудлага ирэхгүй
                </AppText>
                {profile.profile?.blocker || !profile.profile ? (
                  <AppText variant="caption" color={theme.color.warning}>
                    {profile.profile?.blocker ?? 'Бүртгэл админаар баталгаажаагүй байна'}
                  </AppText>
                ) : (
                  <Button label="Идэвхтэй болох" loading={profile.busy} onPress={() => void profile.toggle(true)} />
                )}
              </View>
            ) : null}
            {profile.error ? <ErrorBox message={profile.error} /> : null}
            {offerMessage ? <ErrorBox message={offerMessage} /> : null}
            {offers.live.length > 0 ? (
              <View style={{ gap: theme.space[2] }}>
                <AppText variant="label" color={theme.color.navy}>
                  Шинэ дуудлага ({offers.live.length})
                </AppText>
                {offers.live.map(({ offer, seconds }) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    seconds={seconds}
                    busy={offers.busyId === offer.id}
                    disabled={offers.busyId !== null}
                    onAccept={() => void respond(offer.id, 'accept')}
                    onDecline={() => void respond(offer.id, 'decline')}
                  />
                ))}
              </View>
            ) : null}
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
