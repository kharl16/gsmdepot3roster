import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    console.log('Starting manage-admin function');
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authorization header to verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract the token from the Authorization header
    const token = authHeader.replace('Bearer ', '');
    console.log('Token received, verifying user...');

    // Use admin client to get user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User verified:', user.id);

    // Check if requesting user is an admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError) {
      console.log('Role check error:', roleError.message);
    }

    if (!isAdmin) {
      console.error('User is not an admin:', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User is admin, proceeding with action');

    const { action, email, password, createIfNotExists } = await req.json();
    console.log('Action:', action, 'Email:', email, 'CreateIfNotExists:', createIfNotExists);

    if (action === 'add') {
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Look up user by email in auth.users via admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error listing users:', authError);
        return new Response(JSON.stringify({ error: 'Failed to search users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let targetUser = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      // If user doesn't exist and createIfNotExists is true, create the user
      if (!targetUser && createIfNotExists && password) {
        console.log('User not found, creating new user:', email);
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm the email
        });
        
        if (createError) {
          console.error('Error creating user:', createError);
          return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        targetUser = newUser.user;
        console.log('User created successfully:', targetUser?.id);
      }
      
      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found with that email. The user must sign up first, or enable "Create if not exists" option.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user is already an admin
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', targetUser.id)
        .eq('role', 'admin')
        .single();

      if (existingRole) {
        return new Response(JSON.stringify({ error: 'User is already an admin' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Add admin role
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: targetUser.id, role: 'admin' });

      if (insertError) {
        console.error('Error inserting role:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to add admin role' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Ensure user has a profile
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: targetUser.id, email: targetUser.email }, { onConflict: 'id' });

      console.log('Successfully added admin:', targetUser.email);
      return new Response(JSON.stringify({ success: true, userId: targetUser.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset-password') {
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and new password are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find user by email
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error listing users:', authError);
        return new Response(JSON.stringify({ error: 'Failed to search users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const targetUser = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found with that email' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update the user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.id,
        { password }
      );

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(JSON.stringify({ error: `Failed to reset password: ${updateError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Successfully reset password for:', targetUser.email);
      return new Response(JSON.stringify({ success: true, userId: targetUser.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in manage-admin function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
