import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { AccessToken } from "npm:livekit-server-sdk"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Always handle OPTIONS preflight first
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { roomName, participantName, identity, isTeacher } = await req.json()

    if (!roomName || !participantName || !identity) {
      throw new Error('Missing roomName, participantName, or identity')
    }

    const API_KEY = Deno.env.get('LIVEKIT_API_KEY')
    const API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')

    if (!API_KEY || !API_SECRET) {
      throw new Error('LiveKit API keys not configured on server')
    }

    // Create Access Token
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: identity,
      name: participantName,
    })

    // Set Permissions
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true, // Everyone can publish, but UI controls who actually does
      canSubscribe: true,
      canPublishData: true,
    })

    // We can add metadata to identify roles in the room
    // Simple JSON string defining role
    at.metadata = JSON.stringify({
      role: isTeacher ? 'teacher' : 'student'
    })

    const token = await at.toJwt()

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("LinkKit Token Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      {
        status: 500, // Return 500 but with CORS headers so browser sees the JSON
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})
