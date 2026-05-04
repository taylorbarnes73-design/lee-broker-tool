ALTER TABLE `brokerAdminRequests`
  MODIFY `emailMessageId` varchar(512) NOT NULL,
  MODIFY `internetMessageId` varchar(512),
  MODIFY `threadKey` varchar(512);
