use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};

use crate::VaultState;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user : Signer<'info>,
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

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount:u64)->Result<()>{
        transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer { 
                    from:self.user.to_account_info(),
                    to:self.vault.to_account_info()
                }
            ),
            amount
        )?;
        Ok(())
    }
    
}
