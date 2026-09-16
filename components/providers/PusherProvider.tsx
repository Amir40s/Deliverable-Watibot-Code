"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getPusherClient } from '@/lib/pusher-client'
import type Pusher from 'pusher-js'
import { useSession } from 'next-auth/react'

interface PusherContextType {
  pusher: Pusher | null
  isConnected: boolean
}

const PusherContext = createContext<PusherContextType>({
  pusher: null,
  isConnected: false
})

export const usePusher = () => useContext(PusherContext)

export const PusherProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session, update } = useSession()
  const [pusher, setPusher] = useState<Pusher | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const initPusher = async () => {
    try {
      const res = await fetch('/api/realtime/config')
      if (res.ok) {
        const config = await res.json()
        if (config.pusherKey && config.pusherCluster) {
          // If already existing, disconnect
          if (pusher) pusher.disconnect()

          const client = getPusherClient(config.pusherKey, config.pusherCluster)
          
          client.connection.bind('connected', () => setIsConnected(true))
          client.connection.bind('disconnected', () => setIsConnected(false))
          
          // Listen for config updates
          const channel = client.subscribe('system-channel')
          channel.bind('pusher-config-updated', () => {
            console.log('Pusher configuration updated, re-initializing...')
            initPusher()
          })

          // Listen for session updates for the current user
          if (session?.user?.id) {
            const userChannel = client.subscribe(`user-${session.user.id}`)
            userChannel.bind('session-update', () => {
              console.log('Session update requested via Pusher...')
              update()
            })
            userChannel.bind('chat-assigned', (payload: any) => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('chat-assigned', { detail: payload }))
              }
            })
            userChannel.bind('chat-unassigned', (payload: any) => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('chat-unassigned', { detail: payload }))
              }
            })
          }

          setPusher(client)
        }
      }
    } catch (error) {
      console.error('Failed to initialize Pusher:', error)
    }
  }

  useEffect(() => {
    initPusher()
    return () => {
      if (pusher) pusher.disconnect()
    }
  }, [session?.user?.id]) // Re-init when user changes to subscribe to correct channel

  return (
    <PusherContext.Provider value={{ pusher, isConnected }}>
      {children}
    </PusherContext.Provider>
  )
}
