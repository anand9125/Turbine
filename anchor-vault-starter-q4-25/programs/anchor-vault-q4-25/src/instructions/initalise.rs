use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};

use crate::VaultState;

#[derive(Accounts)]
pub struct Initialize<'info>{
   #[account(mut)]
   pub user : Signer<'info>,
   #[account(
       init,
       payer = user,
       seeds = [b"state",user.key().as_ref()],
       bump ,
       space = VaultState::DISCRIMINATOR.len() + VaultState::INIT_SPACE
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

impl<'info>Initialize<'info>{
    pub fn initialize(&mut self,bumps:&InitializeBumps)->Result<()>{
        
        let rent_exempt = Rent::get()?.minimum_balance(self.vault.to_account_info().data_len());

        transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                Transfer { 
                    from:self.user.to_account_info(),
                    to:self.vault.to_account_info()
                 }   
            ),rent_exempt
        )?;
        self.vault_state.vault_bump = bumps.vault;
        self.vault_state.state_bump = bumps.vault_state;
        Ok(())
    }
}
