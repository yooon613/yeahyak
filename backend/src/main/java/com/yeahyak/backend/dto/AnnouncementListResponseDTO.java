package com.yeahyak.backend.dto;

import com.yeahyak.backend.entity.Announcement;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class AnnouncementListResponseDTO {
    private List<Announcement> content;
    private long total;
}
