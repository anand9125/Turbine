use anchor_lang::prelude::*;
use mpl_core::{
    instructions::UpdatePluginV1CpiBuilder,
    types::{FreezeDelegate, Plugin},
    ID as CORE_PROGRAM_ID,
};

use crate::{error::MPLXCoreError, state::CollectionAuthority};

#[derive(Accounts)]
pub struct FreezeNft<'info> {
    // The signer is the authority that will freeze the NFT
    #[account(mut)]
    pub signer:Signer<'info>,

    #[account(mut)]
    /// CHECK: Validated by Core
    // The asset is the NFT that will be frozen
    pub asset: UncheckedAccount<'info>,
    #[account(
    mut,
    constraint = collection.owner == &CORE_PROGRAM_ID @ MPLXCoreError::InvalidCollection,
    constraint = !collection.data_is_empty() @ MPLXCoreError::CollectionAlreadyInitialized
   )]
    /// CHECK: Validated by Core
    // The collection is the collection that the NFT belongs to
    pub collection: UncheckedAccount<'info>,
    #[account(
    mut,
    seeds = [b"collection_authority" , collection.key().as_ref()],
    bump = collection_authority.bump
   )]

    // The collection authority is the authority that will freeze the NFT
    pub collection_authority: Account<'info, CollectionAuthority>,
    #[account(
        address = CORE_PROGRAM_ID
   )]
    /// CHECK: Validated by Address
   // The core program id is the program that will be used to freeze the NFT
    pub core_program_id: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> FreezeNft<'info> {

    // Freezes the NFT
    pub fn freeze_nft(&mut self) -> Result<()> {

        // Check if the signer is the creator of the collection
        require!(
            self.signer.key() == self.collection_authority.creator,
            MPLXCoreError::NotAuthorized
        );

        // Create the signer seeds for the collection authority
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"collection_authority",
            &self.collection.key().to_bytes(),
            &[self.collection_authority.bump],
        ]];

        // Freeze the NFT
        UpdatePluginV1CpiBuilder::new(&self.core_program_id.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .authority(Some(&self.collection_authority.to_account_info()))
            .payer(&self.signer.to_account_info())
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .invoke_signed(signer_seeds)?;

            
        Ok(())
    }
}