use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    pub struct MatchSession {
        user_a_id: u64,
        user_b_id: u64,
        user_a_liked: bool,
        user_b_liked: bool,
        session_created_at: u64,
        last_updated: u64,
    }

    pub struct UserLikeAction {
        user_id: u64,
        target_id: u64,
        like_action: bool,
        timestamp: u64,
    }
    pub struct MatchResult {
        is_mutual_match: bool,
        session_status: u8,
        match_timestamp: u64,
    }


    #[instruction]
    pub fn init_match_session(
        mxe: Mxe,
        user_a_id: u64,
        user_b_id: u64,
        current_timestamp: u64
    ) -> Enc<Mxe, MatchSession> {
        let match_session = MatchSession {
            user_a_id,
            user_b_id,
            user_a_liked: false,
            user_b_liked: false,
            session_created_at: current_timestamp,
            last_updated: current_timestamp,
        };

        mxe.from_arcis(match_session)
    }


    #[instruction]
    pub fn submit_like(
        like_action_ctxt: Enc<Shared, UserLikeAction>,
        match_session_ctxt: Enc<Mxe, MatchSession>,
    ) -> (Enc<Mxe, MatchSession>, u8) {
        let like_action = like_action_ctxt.to_arcis();
        let mut match_session = match_session_ctxt.to_arcis();
        
        let mut status_flag = 0u8;
        if like_action.user_id == match_session.user_a_id && 
           like_action.target_id == match_session.user_b_id &&
           !match_session.user_a_liked {
            match_session.user_a_liked = like_action.like_action;
            match_session.last_updated = like_action.timestamp;
            status_flag = 1;
            if match_session.user_a_liked && match_session.user_b_liked {
                status_flag = 2;
            }
            
        } else if like_action.user_id == match_session.user_b_id && 
                  like_action.target_id == match_session.user_a_id &&
                  !match_session.user_b_liked {
            match_session.user_b_liked = like_action.like_action;
            match_session.last_updated = like_action.timestamp;
            status_flag = 1;
            if match_session.user_a_liked && match_session.user_b_liked {
                status_flag = 2;
            }
            
        } else {
            status_flag = 0;
        }
        
        (match_session_ctxt.owner.from_arcis(match_session), status_flag.reveal())
    }


    #[instruction]
    pub fn check_mutual_match(
        match_session_ctxt: Enc<Mxe, MatchSession>,
        current_timestamp: u64
    ) -> MatchResult {
        let match_session = match_session_ctxt.to_arcis();
        
        let is_mutual = match_session.user_a_liked && match_session.user_b_liked;
        
        let status = if is_mutual {
            1u8
        } else if match_session.user_a_liked || match_session.user_b_liked {
            0u8
        } else {
            2u8
        };
        
        let match_timestamp = if is_mutual { current_timestamp } else { 0u64 };
        
        MatchResult {
            is_mutual_match: is_mutual,
            session_status: status,
            match_timestamp,
        }.reveal()
    }


    pub struct UserPreferences {
        preferred_age_min: u8,
        preferred_age_max: u8,
        interests_count: u8,
        location_preference: u8,
        relationship_type: u8,
    }

    pub struct UserProfile {
        age: u8,
        interests_count: u8,
        location_score: u8,
        relationship_type: u8,
    }

    #[instruction]
    pub fn calculate_compatibility(
        user_a_prefs_ctxt: Enc<Shared, UserPreferences>,
        user_b_profile_ctxt: Enc<Shared, UserProfile>,
        user_b_prefs_ctxt: Enc<Shared, UserPreferences>, 
        user_a_profile_ctxt: Enc<Shared, UserProfile>,
    ) -> u8 {
        let user_a_prefs = user_a_prefs_ctxt.to_arcis();
        let user_b_profile = user_b_profile_ctxt.to_arcis();
        let user_b_prefs = user_b_prefs_ctxt.to_arcis();
        let user_a_profile = user_a_profile_ctxt.to_arcis();
        
        let mut compatibility_score = 0u8;
        
        // Age compatibility (0-30 points)
        if user_b_profile.age >= user_a_prefs.preferred_age_min && 
           user_b_profile.age <= user_a_prefs.preferred_age_max &&
           user_a_profile.age >= user_b_prefs.preferred_age_min &&
           user_a_profile.age <= user_b_prefs.preferred_age_max {
            compatibility_score += 30;
        }
        
        // Interests compatibility (0-25 points)
        let interests_score = if user_a_profile.interests_count > 0 && user_b_profile.interests_count > 0 {
            // Simplified interests matching
            let min_interests = if user_a_profile.interests_count < user_b_profile.interests_count {
                user_a_profile.interests_count
            } else {
                user_b_profile.interests_count
            };
            (min_interests * 25) / 10 // Scale to max 25 points
        } else {
            0
        };
        compatibility_score += if interests_score > 25 { 25 } else { interests_score };
        
        // Location compatibility (0-25 points)
        let location_score = (user_a_profile.location_score + user_b_profile.location_score) / 2;
        compatibility_score += if location_score > 25 { 25 } else { location_score };
        
        // Relationship type compatibility (0-20 points)
        if user_a_profile.relationship_type == user_b_profile.relationship_type {
            compatibility_score += 20;
        }
        
        // Return score capped at 100
        if compatibility_score > 100 { 100 } else { compatibility_score }.reveal()
    }
}
