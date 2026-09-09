// In src/supabaseClient.ts

import { createClient } from '@supabase/supabase-js'

// Read the variables from the environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const createVisitorSupabase = (visitorSessionId: string) => createClient(supabaseUrl, supabaseAnonKey, {
	global: {
		headers: {
			'x-visitor-session-id': visitorSessionId,
		},
	},
})