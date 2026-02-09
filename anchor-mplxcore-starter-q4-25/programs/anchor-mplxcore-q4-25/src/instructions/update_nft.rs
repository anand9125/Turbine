use anchor_lang::prelude::*;
use mpl_core::{instructions::UpdateV2CpiBuilder, ID as CORE_PROGRAM_ID};

use crate::{error::MPLXCoreError, state::CollectionAuthority};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateNftArgs {
    pub new_name: String,
    pub new_uri: String,
}

#[derive(Accounts)]
pub struct UpdateNft<'info> {
    // The signer is the authority that will update the NFT
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    // The asset is the NFT that will be updated
    /// CHECK: Validated by MPL Core via UpdateV2 CPI.
    pub asset: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = collection.owner == &CORE_PROGRAM_ID @ MPLXCoreError::InvalidCollection,
        constraint = !collection.data_is_empty() @ MPLXCoreError::CollectionNotInitialized
    )]
    // The collection is the collection that the NFT belongs to
    /// CHECK: Validated by Core.
    pub collection: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"collection_authority", collection.key().as_ref()],
        bump = collection_signer.bump
    )]
    // The collection signer is the authority that will update the NFT
    pub collection_signer: Account<'info, CollectionAuthority>,
    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: Constrained to MPL Core program ID.
    pub core_program_id: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> UpdateNft<'info> {
    // Updates the NFT
    pub fn update_nft(&mut self, args: UpdateNftArgs) -> Result<()> {
        require!(
            self.signer.key() == self.collection_signer.creator,
            MPLXCoreError::NotAuthorized
        );
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"collection_authority",
            &self.collection.key().to_bytes(),
            &[self.collection_signer.bump],
        ]];

        // Update the NFT
        UpdateV2CpiBuilder::new(&self.core_program_id.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.signer.to_account_info())
            .authority(Some(&self.collection_signer.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .new_name(args.new_name)
            .new_uri(args.new_uri)
            .invoke_signed(signer_seeds)?;

        Ok(())
    }
}