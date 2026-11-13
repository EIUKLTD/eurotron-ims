1/5

Next.js 16.2.6
Turbopack
Console TypeError
Server



cookieStore.get is not a function
src\app\dashboard\layout.tsx (11:57) @ Object.get


   9 |     process.env.NEXT_PUBLIC_SUPABASE_URL!,
  10 |     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
> 11 |     { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
     |                                                         ^
  12 |   )
  13 |   const { data: { user } } = await supabase.auth.getUser()
  14 |   if (!user) redirect('/auth')
Call Stack
31

Object.get
src\app\dashboard\layout.tsx (11:57)
getWithHints
node_modules\@supabase\ssr\src\cookies.ts (128:39)
getAll
node_modules\@supabase\ssr\src\cookies.ts (142:52)
Object.getItem
node_modules\@supabase\ssr\src\cookies.ts (363:34)
getItemAsync
node_modules\@supabase\auth-js\src\lib\helpers.ts (133:31)
SupabaseAuthClient.__loadSession
node_modules\@supabase\auth-js\src\GoTrueClient.ts (2819:46)
SupabaseAuthClient._useSession
node_modules\@supabase\auth-js\src\GoTrueClient.ts (2777:33)
SupabaseAuthClient._emitInitialSession
node_modules\@supabase\auth-js\src\GoTrueClient.ts (4068:23)
<anonymous>
node_modules\@supabase\auth-js\src\GoTrueClient.ts (4060:14)
<anonymous>
node_modules\@supabase\auth-js\src\GoTrueClient.ts (2709:26)
SupabaseAuthClient.lockNoOp [as lock]
node_modules\@supabase\auth-js\src\GoTrueClient.ts (204:16)
SupabaseAuthClient._acquireLock
node_modules\@supabase\auth-js\src\GoTrueClient.ts (2703:25)
<anonymous>
node_modules\@supabase\auth-js\src\GoTrueClient.ts (4059:18)
resolveErrorDev
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1919:105)
getOutlinedModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1469:28)
parseModelString
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1584:50)
reviveModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2522:66)
parseModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2517:16)
initializeModelChunk
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1084:25)
getOutlinedModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1407:17)
parseModelString
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1639:50)
reviveModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2522:66)
reviveModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2525:61)
parseModel
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2517:16)
initializeModelChunk
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (1084:25)
resolveConsoleEntry
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2047:96)
processFullStringRow
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2453:17)
processFullBinaryRow
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2393:9)
processBinaryChunk
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2502:221)
progress
file:///C:/Users/Max%20Moltrasio/Desktop/eurotron/.next/dev/static/chunks/0~e5_next_dist_compiled_react-server-dom-turbopack_0md74_u._.js (2676:20)
DashboardLayout
<anonymous>
1
2
This page couldn’t load
A server error occurred. Reload to try again.

Reload
ERROR 924893454
