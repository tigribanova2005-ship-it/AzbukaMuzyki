const { createClient } = require("@supabase/supabase-js");

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const generatePassword = () => {
  let out = "";
  for (let i = 0; i < 12; i++) out += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  return out;
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Сервер не настроен (нет SUPABASE_SERVICE_ROLE_KEY)" }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: "Не авторизован" }) };

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Недействительный токен" }) };
  }

  const { data: caller, error: callerErr } = await admin
    .from("teachers").select("role").eq("auth_user_id", userData.user.id).single();
  if (callerErr || !caller || caller.role !== "admin") {
    return { statusCode: 403, body: JSON.stringify({ error: "Только администратор может добавлять педагогов" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Некорректный запрос" }) }; }

  const { name, email, role, directions } = body;
  if (!name || !email || !role) {
    return { statusCode: 400, body: JSON.stringify({ error: "Укажите имя, email и роль" }) };
  }

  const tempPassword = generatePassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (createErr) {
    return { statusCode: 400, body: JSON.stringify({ error: createErr.message }) };
  }

  const { data: row, error: insertErr } = await admin.from("teachers").insert({
    name, email, role, directions: directions || [], auth_user_id: created.user.id,
  }).select().single();
  if (insertErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { statusCode: 400, body: JSON.stringify({ error: insertErr.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ teacher: row, tempPassword }) };
};
