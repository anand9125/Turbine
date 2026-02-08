use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, Burn, Mint, Token, TokenAccount, Transfer,
};
use constant_product_curve::ConstantProduct;

use crate::{errors::AmmError, state::Config};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub mint_x: Account<'info, Mint>,
    pub mint_y: Account<'info, Mint>,

    #[account(
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"lp", config.key().as_ref()],
        bump
    )]
    pub mint_lp: Account<'info, Mint>,

    // Pool vaults
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = config
    )]
    pub vault_x: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config
    )]
    pub vault_y: Account<'info, TokenAccount>,

    // User token accounts
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = user
    )]
    pub user_x: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = user
    )]
    pub user_y: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_lp,
        associated_token::authority = user
    )]
    pub user_lp: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(
        &mut self,
        amount: u64, 
        min_x: u64,
        min_y: u64,
    ) -> Result<()> {
      
        require!(!self.config.locked, AmmError::PoolLocked);
        require!(amount > 0, AmmError::InvalidAmount);
        require!(
            self.mint_lp.supply > 0,
            AmmError::NoLiquidityInPool
        );

    
        let amounts = ConstantProduct::xy_withdraw_amounts_from_l(
            self.vault_x.amount,
            self.vault_y.amount,
            self.mint_lp.supply,
            amount,
            6, 
        )
        .map_err(|_| AmmError::MathOverflow)?;

        let x_out = amounts.x;
        let y_out = amounts.y;

        require!(x_out >= min_x, AmmError::SlippageExceeded);
        require!(y_out >= min_y, AmmError::SlippageExceeded);

        self.burn_lp_tokens(amount)?;

        self.withdraw_tokens(true, x_out)?;
        self.withdraw_tokens(false, y_out)?;

        Ok(())
    }
        pub fn withdraw_tokens(&self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = if is_x {
            (
                self.vault_x.to_account_info(),
                self.user_x.to_account_info(),
            )
        } else {
            (
                self.vault_y.to_account_info(),
                self.user_y.to_account_info(),
            )
        };

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"config",
            &self.config.seed.to_le_bytes(),
            &[self.config.config_bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from,
                    to,
                    authority: self.config.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        Ok(())
    }
        pub fn burn_lp_tokens(&self, amount: u64) -> Result<()> {
        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.mint_lp.to_account_info(),
                    from: self.user_lp.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }
}



