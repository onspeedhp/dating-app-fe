// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;
use serde::{Serialize, Deserialize};

declare_id!("Gjs746NpmhmHR5RXY21qNRzw2igtLcMAUZWDjABesiT4");

// ============================================================================
// DATA MODELS AND STRUCTS
// ============================================================================

/// Profile creation data structure for blockchain storage
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateProfileData {
    pub username: String,
    pub avatar_url: String,
    pub age: u8,
    pub location_city: String,
    pub encrypted_private_data: Vec<u8>,    // Encrypted sensitive data (e.g., income)
    pub encrypted_preferences: Vec<u8>,     // Encrypted matching preferences  
    pub encryption_pubkey: [u8; 32],        // User's public key for encryption
    pub profile_version: u8,
}

/// Complete profile input (for client-side processing before encryption)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateProfileInput {
    pub username: String,
    pub avatar_url: String,
    pub age: u8,
    pub location_city: String,
    pub private_data: PrivateProfileData,
    pub preferences: MatchingPreferences,
}

/// Private sensitive data that gets encrypted
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PrivateProfileData {
    pub income: String,  // Simplified to just income for sensitive data
}

/// Matching preferences data
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MatchingPreferences {
    pub preferred_age_min: u8,
    pub preferred_age_max: u8,
    pub preferred_distance_km: u16,
    pub interests: Vec<String>,
    pub relationship_type: String,
}

// ============================================================================
// ACCOUNT STRUCTURES
// ============================================================================

/// User profile account stored on blockchain
#[account]
pub struct UserProfile {
    // Account metadata
    pub owner: Pubkey,
    pub bump: u8,
    pub created_at: i64,
    pub last_updated: i64,
    pub profile_version: u8,
    
    // Public profile information
    pub username: String,
    pub avatar_url: String,
    pub age: u8,
    pub location_city: String,
    pub is_active: bool,
    
    // Encryption and privacy
    pub encryption_pubkey: [u8; 32],
    pub encrypted_private_data: Vec<u8>,     // Encrypted sensitive data
    pub encrypted_preferences: Vec<u8>,      // Encrypted matching preferences
    
    // Encrypted interaction history
    pub encrypted_likes_given: Vec<u8>,
    pub encrypted_likes_received: Vec<u8>,
    pub encrypted_matches: Vec<u8>,
    
    // Public statistics
    pub total_likes_given: u32,
    pub total_likes_received: u32,
    pub total_matches: u32,
}

impl UserProfile {
    pub const INIT_SPACE: usize = 
        32 +      // owner
        1 +       // bump
        8 +       // created_at
        8 +       // last_updated
        1 +       // profile_version
        32 +      // username (4 + 28)
        200 +     // avatar_url (4 + 196)
        1 +       // age
        50 +      // location_city (4 + 46)
        1 +       // is_active
        32 +      // encryption_pubkey
        1000 +    // encrypted_private_data (4 + 996)
        500 +     // encrypted_preferences (4 + 496)
        500 +     // encrypted_likes_given (4 + 496)
        500 +     // encrypted_likes_received (4 + 496)
        300 +     // encrypted_matches (4 + 296)
        4 +       // total_likes_given
        4 +       // total_likes_received
        4;        // total_matches
}

/// Match session account for encrypted matching between two users
#[account]
pub struct MatchPairSession {
    pub session_id: u64,
    pub user_a: Pubkey,
    pub user_b: Pubkey,
    pub encrypted_match_data: [[u8; 32]; 6], // Encrypted MPC session data
    pub nonce: u128,
    pub created_at: i64,
    pub last_updated: i64,
    pub is_finalized: bool,
    pub match_found: bool,
    pub bump: u8,
}

impl MatchPairSession {
    pub const INIT_SPACE: usize = 
        8 +        // session_id
        32 +       // user_a
        32 +       // user_b
        32 * 6 +   // encrypted_match_data (6 x 32 bytes)
        16 +       // nonce
        8 +        // created_at
        8 +        // last_updated
        1 +        // is_finalized
        1 +        // match_found
        1;         // bump
}

// ============================================================================
// CONTEXT STRUCTS
// ============================================================================

/// Context for creating a user profile
#[derive(Accounts)]
#[instruction(profile_data: CreateProfileData)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    pub system_program: Program<'info, System>,
}

/// Context for initializing computation definitions
#[derive(Accounts)]
pub struct InitCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}

// ============================================================================
// EVENTS
// ============================================================================

/// Event emitted when a user profile is created
#[event]
pub struct ProfileCreatedEvent {
    pub user: Pubkey,
    pub profile_pda: Pubkey,
    pub username: String,
    pub age: u8,
    pub location_city: String,
    pub timestamp: i64,
}

/// Event emitted when a match session is created
#[event]
pub struct MatchSessionCreatedEvent {
    pub session_id: u64,
    pub user_a: Pubkey,
    pub user_b: Pubkey,
    pub created_at: i64,
}

/// Event emitted when a like is submitted
#[event]
pub struct LikeSubmittedEvent {
    pub session_id: u64,
    pub timestamp: i64,
}

/// Event emitted when mutual interest is detected
#[event]
pub struct MutualInterestDetectedEvent {
    pub session_id: u64,
    pub timestamp: i64,
}

/// Event emitted when a mutual match is found
#[event]
pub struct MutualMatchFoundEvent {
    pub session_id: u64,
    pub user_a: Pubkey,
    pub user_b: Pubkey,
    pub matched_at: i64,
    pub can_start_conversation: bool,
}

/// Event emitted when no mutual match is found
#[event]
pub struct NoMutualMatchEvent {
    pub session_id: u64,
    pub finalized_at: i64,
}

// ============================================================================
// CONSTANTS
// ============================================================================

/// Computation definition offsets for MPC operations
const COMP_DEF_OFFSET_INIT_MATCH_SESSION: u32 = comp_def_offset("init_match_session");
const COMP_DEF_OFFSET_SUBMIT_LIKE: u32 = comp_def_offset("submit_like");
const COMP_DEF_OFFSET_CHECK_MUTUAL_MATCH: u32 = comp_def_offset("check_mutual_match");
const COMP_DEF_OFFSET_CALCULATE_COMPATIBILITY: u32 = comp_def_offset("calculate_compatibility");

// ============================================================================
// ERROR CODES
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
    #[msg("Username too short (minimum 3 characters)")]
    UsernameTooShort,
    #[msg("Username too long (maximum 32 characters)")]
    UsernameTooLong,
    #[msg("Username can only contain letters, numbers and underscores")]
    InvalidUsernameFormat,
    #[msg("Age must be between 18-99")]
    InvalidAge,
    #[msg("Private data too large (maximum 1000 bytes)")]
    DataTooLarge,
    #[msg("Preferences too large (maximum 500 bytes)")]
    PreferencesTooLarge,
    #[msg("Profile already exists")]
    ProfileAlreadyExists,
    #[msg("Invalid encrypted data")]
    InvalidEncryptedData,
    #[msg("Avatar is required")]
    AvatarRequired,
    #[msg("Location information is required")]
    LocationRequired,
    #[msg("Invalid encryption key")]
    InvalidEncryptionKey,
    #[msg("User is not authorized to perform this action")]
    UnauthorizedUser,
    #[msg("Invalid session")]
    InvalidSession,
}

// ============================================================================
// MAIN PROGRAM MODULE
// ============================================================================

#[arcium_program]
pub mod contract {
    use super::*;

    // ========================================================================
    // PROFILE MANAGEMENT FUNCTIONS
    // ========================================================================

    /// Creates a new user profile with encrypted sensitive data
    pub fn create_profile(
        ctx: Context<CreateProfile>,
        profile_data: CreateProfileData,
    ) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        let clock = Clock::get()?;
        
        // Input validation
        require!(profile_data.username.len() >= 3, ErrorCode::UsernameTooShort);
        require!(profile_data.username.len() <= 32, ErrorCode::UsernameTooLong);
        require!(profile_data.age >= 18 && profile_data.age <= 99, ErrorCode::InvalidAge);
        require!(profile_data.encrypted_private_data.len() <= 1000, ErrorCode::DataTooLarge);
        require!(profile_data.encrypted_preferences.len() <= 500, ErrorCode::PreferencesTooLarge);
        require!(!profile_data.avatar_url.is_empty(), ErrorCode::AvatarRequired);
        require!(!profile_data.location_city.is_empty(), ErrorCode::LocationRequired);
        require!(profile_data.encryption_pubkey != [0u8; 32], ErrorCode::InvalidEncryptionKey);
        require!(
            profile_data.username.chars().all(|c| c.is_alphanumeric() || c == '_'),
            ErrorCode::InvalidUsernameFormat
        );

        // Set account metadata
        user_profile.owner = ctx.accounts.user.key();
        user_profile.bump = ctx.bumps.user_profile;
        user_profile.created_at = clock.unix_timestamp;
        user_profile.last_updated = clock.unix_timestamp;
        user_profile.profile_version = profile_data.profile_version;
        
        // Set public profile information
        user_profile.username = profile_data.username.clone();
        user_profile.avatar_url = profile_data.avatar_url;
        user_profile.age = profile_data.age;
        user_profile.location_city = profile_data.location_city.clone();
        user_profile.is_active = true;
        
        // Set encryption data
        user_profile.encryption_pubkey = profile_data.encryption_pubkey;
        user_profile.encrypted_private_data = profile_data.encrypted_private_data;
        user_profile.encrypted_preferences = profile_data.encrypted_preferences;
        
        // Initialize interaction history
        user_profile.encrypted_likes_given = Vec::new();
        user_profile.encrypted_likes_received = Vec::new();
        user_profile.encrypted_matches = Vec::new();
        user_profile.total_likes_given = 0;
        user_profile.total_likes_received = 0;
        user_profile.total_matches = 0;
        
        // Emit profile creation event
        emit!(ProfileCreatedEvent {
            user: ctx.accounts.user.key(),
            profile_pda: user_profile.key(),
            username: profile_data.username,
            age: profile_data.age,
            location_city: profile_data.location_city,
            timestamp: clock.unix_timestamp,
        });
        
        msg!("Profile created successfully for user: {}", ctx.accounts.user.key());
        Ok(())
    }

    // ========================================================================
    // ENCRYPTED MATCHING FUNCTIONS
    // ========================================================================


    /// Initializes an encrypted matching session between two users
    pub fn init_match_session(
        ctx: Context<InitMatchSession>,
        computation_offset: u64,
        session_id: u64,
        user_a: Pubkey,
        user_b: Pubkey,
        nonce: u128,
    ) -> Result<()> {
        let match_session = &mut ctx.accounts.match_pair_session;
        let clock = Clock::get()?;
        
        // Initialize session data
        match_session.session_id = session_id;
        match_session.user_a = user_a;
        match_session.user_b = user_b;
        match_session.nonce = nonce;
        match_session.created_at = clock.unix_timestamp;
        match_session.last_updated = clock.unix_timestamp;
        match_session.is_finalized = false;
        match_session.match_found = false;
        match_session.bump = ctx.bumps.match_pair_session;
        
        // Convert public keys to u64 IDs for MPC computation
        let user_a_bytes: [u8; 8] = user_a.key().as_ref()[0..8].try_into().unwrap();
        let user_b_bytes: [u8; 8] = user_b.key().as_ref()[0..8].try_into().unwrap();
        let user_a_id = u64::from_le_bytes(user_a_bytes);
        let user_b_id = u64::from_le_bytes(user_b_bytes);
        
        // Prepare arguments for MPC computation
        let args = vec![
            Argument::PlaintextU128(nonce),
            Argument::PlaintextU64(user_a_id),
            Argument::PlaintextU64(user_b_id),
            Argument::PlaintextU64(clock.unix_timestamp as u64),
        ];

        // Queue the encrypted computation
        let session_key = match_session.key();
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![CallbackAccount {
                pubkey: session_key,
                is_writable: true,
            }],
            None,
        )?;

        // Emit session creation event
        emit!(MatchSessionCreatedEvent {
            session_id,
            user_a,
            user_b,
            created_at: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Callback for match session initialization MPC computation
    #[arcium_callback(encrypted_ix = "init_match_session")]
    pub fn init_match_session_callback(
        ctx: Context<InitMatchSessionCallback>,
        output: ComputationOutputs<InitMatchSessionOutput>,
    ) -> Result<()> {
        let encrypted_session = match output {
            ComputationOutputs::Success(InitMatchSessionOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let match_session = &mut ctx.accounts.match_pair_session;
        match_session.encrypted_match_data = encrypted_session.ciphertexts;
        match_session.nonce = encrypted_session.nonce;

        msg!("Match session initialized with encrypted data");
        Ok(())
    }


    /// Submits an encrypted like action for a user
    pub fn submit_like(
        ctx: Context<SubmitLike>,
        computation_offset: u64,
        encrypted_user_id: [u8; 32],
        encrypted_target_id: [u8; 32], 
        encrypted_like_action: [u8; 32],
        encrypted_timestamp: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let match_session = &ctx.accounts.match_pair_session;
        
        // Validate user authorization
        require!(
            ctx.accounts.user.key() == match_session.user_a || 
            ctx.accounts.user.key() == match_session.user_b,
            ErrorCode::UnauthorizedUser
        );

        // Prepare encrypted arguments for MPC computation
        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU8(encrypted_user_id),
            Argument::EncryptedU8(encrypted_target_id), 
            Argument::EncryptedU8(encrypted_like_action),
            Argument::EncryptedU8(encrypted_timestamp),
            Argument::PlaintextU128(match_session.nonce),
            Argument::Account(match_session.key(), 8 + 8 + 32 + 32, 32 * 6),
        ];

        // Queue encrypted like computation
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![CallbackAccount {
                pubkey: match_session.key(),
                is_writable: true,
            }],
            None,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "submit_like")]
    pub fn submit_like_callback(
        ctx: Context<SubmitLikeCallback>,
        output: ComputationOutputs<SubmitLikeOutput>,
    ) -> Result<()> {
        let (updated_session, status_flag) = match output {
            ComputationOutputs::Success(SubmitLikeOutput { field_0 }) => {
                (field_0.field_0, field_0.field_1)
            },
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let match_session = &mut ctx.accounts.match_pair_session;
        match_session.encrypted_match_data = updated_session.ciphertexts;
        match_session.nonce = updated_session.nonce;
        match_session.last_updated = Clock::get()?.unix_timestamp;

        match status_flag {
            1 => {
                emit!(LikeSubmittedEvent {
                    session_id: match_session.session_id,
                    timestamp: match_session.last_updated,
                });
                msg!("Like action recorded successfully");
            },
            2 => {
                msg!("Mutual interest detected! Session ready for verification");
                
                emit!(MutualInterestDetectedEvent {
                    session_id: match_session.session_id,
                    timestamp: match_session.last_updated,
                });
            },
            _ => {
                msg!("Like action not processed (possibly duplicate or invalid)");
            }
        }

        Ok(())
    }


    pub fn check_mutual_match(
        ctx: Context<CheckMutualMatch>,
        computation_offset: u64,
    ) -> Result<()> {
        let match_session = &ctx.accounts.match_pair_session;
        let clock = Clock::get()?;

        let args = vec![
            Argument::PlaintextU128(match_session.nonce),
            Argument::Account(match_session.key(), 8 + 8 + 32 + 32, 32 * 6),
            Argument::PlaintextU64(clock.unix_timestamp as u64),
        ];

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![CallbackAccount {
                pubkey: match_session.key(),
                is_writable: true,
            }],
            None,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "check_mutual_match")]
    pub fn check_mutual_match_callback(
        ctx: Context<CheckMutualMatchCallback>,
        output: ComputationOutputs<CheckMutualMatchOutput>,
    ) -> Result<()> {
        let match_result = match output {
            ComputationOutputs::Success(CheckMutualMatchOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        let match_session = &mut ctx.accounts.match_pair_session;
        match_session.is_finalized = true;

        let is_mutual_match = match_result.field_0;
        let session_status = match_result.field_1;
        let _match_timestamp = match_result.field_2;

        if is_mutual_match {
            match_session.match_found = true;
            
            emit!(MutualMatchFoundEvent {
                session_id: match_session.session_id,
                user_a: match_session.user_a,
                user_b: match_session.user_b,
                matched_at: Clock::get()?.unix_timestamp,
                can_start_conversation: true,
            });

            msg!("Mutual match confirmed! Both users liked each other!");
        } else {
            match_session.match_found = false;
            
            emit!(NoMutualMatchEvent {
                session_id: match_session.session_id,
                finalized_at: Clock::get()?.unix_timestamp,
            });

            let status_msg = match session_status {
                0 => "Pending - only one user has acted",
                2 => "No match - both users passed or no actions",
                _ => "Unknown status"
            };
            msg!("No mutual match found - {}", status_msg);
        }

        msg!("Match session finalized - session_id: {}", match_session.session_id);

        Ok(())
    }


    // ========================================================================
    // MPC COMPUTATION DEFINITION INITIALIZATION FUNCTIONS
    // ========================================================================

    /// Dummy function for compatibility
    pub fn init_add_together_comp_def(_ctx: Context<InitCompDef>) -> Result<()> {
        Ok(())
    }

    /// Initialize computation definition for match session initialization
    pub fn init_init_match_session_comp_def(ctx: Context<InitInitMatchSessionCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    /// Initialize computation definition for like submission
    pub fn init_submit_like_comp_def(ctx: Context<InitSubmitLikeCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    /// Initialize computation definition for mutual match checking
    pub fn init_check_mutual_match_comp_def(ctx: Context<InitCheckMutualMatchCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }
}

// ============================================================================
// ACCOUNT VALIDATION STRUCTS FOR MPC OPERATIONS
// ============================================================================


#[queue_computation_accounts("init_match_session", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, session_id: u64, user_a: Pubkey, user_b: Pubkey)]
pub struct InitMatchSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: Mempool account is validated by Arcium framework
    pub mempool_account: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: Executing pool account is validated by Arcium framework
    pub executing_pool: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: Computation account is validated by Arcium framework
    pub computation_account: UncheckedAccount<'info>,
    
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_MATCH_SESSION)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + MatchPairSession::INIT_SPACE,
        seeds = [b"match_session", session_id.to_le_bytes().as_ref()],
        bump
    )]
    pub match_pair_session: Account<'info, MatchPairSession>,
}

#[callback_accounts("init_match_session", payer)]
#[derive(Accounts)]
pub struct InitMatchSessionCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_MATCH_SESSION)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Instructions sysvar is validated by Arcium framework
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub match_pair_session: Account<'info, MatchPairSession>,
}


#[queue_computation_accounts("submit_like", user)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct SubmitLike<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: Mempool account is validated by Arcium framework
    pub mempool_account: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: Executing pool account is validated by Arcium framework
    pub executing_pool: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: Computation account is validated by Arcium framework
    pub computation_account: UncheckedAccount<'info>,
    
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_SUBMIT_LIKE)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    
    #[account(mut)]
    pub match_pair_session: Account<'info, MatchPairSession>,
}

#[callback_accounts("submit_like", user)]
#[derive(Accounts)]
pub struct SubmitLikeCallback<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_SUBMIT_LIKE)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Instructions sysvar is validated by Arcium framework
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub match_pair_session: Account<'info, MatchPairSession>,
}


#[queue_computation_accounts("check_mutual_match", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct CheckMutualMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: Mempool account is validated by Arcium framework
    pub mempool_account: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: Executing pool account is validated by Arcium framework
    pub executing_pool: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: Computation account is validated by Arcium framework
    pub computation_account: UncheckedAccount<'info>,
    
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CHECK_MUTUAL_MATCH)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,
    
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    
    #[account(mut)]
    pub match_pair_session: Account<'info, MatchPairSession>,
}

#[callback_accounts("check_mutual_match", payer)]
#[derive(Accounts)]
pub struct CheckMutualMatchCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CHECK_MUTUAL_MATCH)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Instructions sysvar is validated by Arcium framework
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub match_pair_session: Account<'info, MatchPairSession>,
}


#[init_computation_definition_accounts("init_match_session", payer)]
#[derive(Accounts)]
pub struct InitInitMatchSessionCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Computation definition account is validated by Arcium framework
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("submit_like", payer)]
#[derive(Accounts)]
pub struct InitSubmitLikeCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Computation definition account is validated by Arcium framework
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("check_mutual_match", payer)]
#[derive(Accounts)]
pub struct InitCheckMutualMatchCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Computation definition account is validated by Arcium framework
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}
