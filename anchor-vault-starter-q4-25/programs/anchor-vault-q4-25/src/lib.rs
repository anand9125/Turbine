use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

declare_id!("3BXaLDkByp2xTpvZAhPkbesbJbuzSYCUKdDPbM2Q98BC");

#[program]
pub mod anchor_vault_q4_25 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

     pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

     pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.close()
    }
}


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
        self.vault_state.vault_bump = bumps.vault_state;
        self.vault_state.state_bump = bumps.vault;
        Ok(())
    }
}


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

impl <'info>Deposit<'info> {
    pub fn deposit(&mut self,amount:u64)->Result<()>{
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
    pub fn withdraw(&mut self, _amount: u64) -> Result<()> {
        
        let vault_state = self.vault_state.to_account_info();
        let vault_key = vault_state.key();
        let signer_seeds:&[&[u8]] = &[b"vault",vault_key.as_ref()];
        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer { 
                    from:self.vault.to_account_info(),
                    to:self.user.to_account_info()
                 },&[signer_seeds]
            ),
            _amount
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut)]
    pub user : Signer<'info>,
    #[account(
        mut,
        seeds = [b"state",user.key().as_ref()],
        bump,
        close = user
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

impl<'info> Close<'info> {
    pub fn close(&mut self)-> Result<()> {
        let vault_lamports = self.vault.to_account_info().lamports();
        let vault_state = self.vault_state.to_account_info();
        let vault_key = vault_state.key();
        let signer_seeds:&[&[u8]] = &[b"vault",vault_key.as_ref()];
        transfer(
            CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer { 
                    from:self.vault.to_account_info(),
                    to:self.user.to_account_info()
                 },&[signer_seeds]
            ),
            vault_lamports
        )?;
        Ok(())
    }
}


#[derive(InitSpace)]
#[account]
pub struct VaultState {
    pub vault_bump: u8,
    pub state_bump: u8,
}
