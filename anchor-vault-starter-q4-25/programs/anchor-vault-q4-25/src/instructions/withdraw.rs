use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};

use crate::VaultState;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"state",user.key().as_ref()],
        bump 
    )]
    pub vault_state : Account<'info,VaultState>,
    #[account(
        mut,
        seeds = [b"vault",vault_state.key().as_ref()],
        bump
    )]
    pub vault : SystemAccount<'info>,
    pub system_program : Program<'info,System>
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let vault_state_key = self.vault_state.key();
        let bump = self.vault_state.vault_bump; 
        
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"vault",
            vault_state_key.as_ref(),
            &[bump]  
        ]];
        
        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer { 
                    from:self.vault.to_account_info(),
                    to:self.user.to_account_info()
                 },signer_seeds
            ),
            amount
        )?;
        Ok(())
    }
}
