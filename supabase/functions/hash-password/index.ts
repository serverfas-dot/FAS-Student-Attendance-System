import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { password, hash: existingHash, testPassword } = body;

    if (testPassword && existingHash) {
      console.log('=== HASH VALIDATION TEST ===');
      console.log('Test password:', testPassword);
      console.log('Test password length:', testPassword.length);
      console.log('Test password bytes:', Array.from(testPassword).map((c, i) => `${i}:${c.charCodeAt(0)}`).join(' '));
      console.log('Existing hash:', existingHash);
      console.log('Hash length:', existingHash.length);

      const isValid = await bcrypt.compare(testPassword, existingHash);
      console.log('Comparison result:', isValid);

      const freshHash = await bcrypt.hash(testPassword, 10);
      const freshTest = await bcrypt.compare(testPassword, freshHash);
      console.log('Fresh hash test (should be true):', freshTest);
      console.log('Fresh hash:', freshHash);

      return new Response(
        JSON.stringify({
          isValid,
          testPassword: testPassword,
          hash: existingHash,
          freshHash,
          freshTest,
          passwordLength: testPassword.length
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    const testCompare = await bcrypt.compare(password, hash);

    return new Response(
      JSON.stringify({
        hash,
        testCompare,
        passwordLength: password.length
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});