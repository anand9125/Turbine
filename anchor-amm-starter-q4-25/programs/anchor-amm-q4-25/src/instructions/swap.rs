use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::{errors::AmmError, state::{Config, ConstantProduct}};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user : Signer<'info>,
    pub mint_x : Account<'info, Mint>,
    pub mint_y : Account<'info, Mint>,

    #[account(
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        associated_token ::mint = mint_x,
        associated_token::authority = config
    )]
    pub vault_x : Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config
    )]
    pub vault_y : Account<'info , TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = user
    )]
    pub user_x :Account<'info,TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = user
    )]
    pub user_y : Account<'info,TokenAccount>,
    pub token_program : Program<'info,Token>,
    pub system_program : Program<'info,System>,

}

impl<'info> Swap<'info> {
    pub fn swap(&mut self, is_x: bool, amount_in: u64, min_out: u64) -> Result<()> {
      
        require!(!self.config.locked , AmmError::PoolLocked);
        require!(amount_in>0,AmmError::InvalidAmount);
        
        require!(self.vault_x.amount>0 && self.vault_y.amount >0,AmmError::NoLiquidityInPool);

        let mut curve = ConstantProduct{
            x:self.vault_x.amount,
            y : self.vault_y.amount,
            fee : self.config.fee as u64
        };
        let pair = if is_x{
            crate::state::LiquidityPair::X
        }else{
            crate::state::LiquidityPair::Y
        };

        let result = curve
            .swap(pair, amount_in, min_out)
            .map_err(|_| AmmError::MathOverflow)?;
       
        self.deposit_tokens(is_x, amount_in)?;
        self.withdraw_tokens(!is_x, result.withdraw)?;

        Ok(())
        

}

    fn deposit_tokens(&self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = if is_x {
            (&self.user_x, &self.vault_x)
        } else {
            (&self.user_y, &self.vault_y)
        };

        transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    fn withdraw_tokens(&self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = if is_x {
            (&self.vault_x, &self.user_x)
        } else {
            (&self.vault_y, &self.user_y)
        };

        let seeds: &[&[&[u8]]] = &[&[
            b"config",
            &self.config.seed.to_le_bytes(),
            &[self.config.config_bump],
        ]];

        transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                seeds,
            ),
            amount,
        )?;

        Ok(())
    }
        
}


